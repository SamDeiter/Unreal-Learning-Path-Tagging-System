/**
 * useSearchSubmit — Shared hook for the 4-step search-to-path pipeline.
 *
 * Steps:
 *   1. runSearchPipeline()          — semantic + transcript search
 *   2. queryLearningPath() CF       — Cloud Function diagnosis (with off-topic + fallback)
 *   3. matchAndFlattenToVideos()    — course → video mapping
 *   4. buildBlendedPathFromDiagnosis() — blended path assembly
 *
 * Used by useProblemFirst and useExploreFirst to avoid duplicating
 * ~100 lines of identical pipeline logic.
 */
import { useMemo } from "react";
import { getFirebaseApp } from "../services/firebaseConfig";
import {
  trackQuerySubmitted,
  trackDiagnosisGenerated,
  trackLearningPathGenerated,
} from "../services/analyticsService";
import { useTagData } from "../context/TagDataContext";
import { devWarn } from "../utils/logger";

// Shared services
import { runSearchPipeline } from "../services/searchPipeline";
import { buildBlendedPathFromDiagnosis } from "../services/blendedPathBuilder";
import { matchAndFlattenToVideos } from "../services/courseToVideos";

/**
 * Execute the shared 4-step search pipeline.
 *
 * @param {Object} params
 * @param {Object} params.inputData       - User input (query, detectedTagIds, etc.)
 * @param {Array}  params.courses         - All available courses
 * @param {Object} params.cloudFnPayload  - Extra fields for the CF call ({mode, caseReport, …})
 * @param {Object} params.pipelineOpts    - Per-hook options
 * @param {number} [params.pipelineOpts.maxPassages=8]           - Max passages for search
 * @param {boolean} [params.pipelineOpts.preferTroubleshooting]  - Prefer troubleshooting videos
 * @param {string} [params.pipelineOpts.errorLog]                - Error log text
 * @param {Array}  [params.pipelineOpts.stopWords]               - Stopwords for blended path
 * @param {string} [params.pipelineOpts.personaId]               - Persona ID for tracking
 * @param {Array}  [params.pipelineOpts.offTopicExamples]        - Example queries for off-topic errors
 * @returns {Object} Pipeline result with all derived data
 */
export async function executeSearchPipeline({
  inputData,
  courses,
  cloudFnPayload,
  pipelineOpts = {},
}) {
  const {
    maxPassages = 8,
    preferTroubleshooting = false,
    errorLog = "",
    stopWords = [],
    personaId = null,
    offTopicExamples = [],
  } = pipelineOpts;

  // ── Step 1: Shared search pipeline ──
  const searchResult = await runSearchPipeline(inputData.query, { maxPassages });
  const { semanticResults, retrievedPassages } = searchResult;
  const vertexAIDocs = searchResult.vertexAIDocs || null;

  // Track query
  await trackQuerySubmitted(inputData.query, inputData.detectedTagIds, personaId);

  // ── Step 2: Cloud Function call with off-topic detection + fallback ──
  let cartData;


  try {
    const { getFunctions, httpsCallable } = await import("firebase/functions");
    const app = getFirebaseApp();
    const functions = getFunctions(app, "us-central1");
    const queryLearningPath = httpsCallable(functions, "queryLearningPath");

    const cfPayload = {
      query: inputData.query,
      detectedTagIds: inputData.detectedTagIds,
      retrievedContext: retrievedPassages.slice(0, maxPassages),
      ...cloudFnPayload,
    };

    const result = await queryLearningPath(cfPayload);

    if (!result.data.success && result.data.error === "off_topic") {
      const fallbackMsg =
        result.data.message ||
        "This doesn't appear to be a UE5 topic.";
      return { error: fallbackMsg, isOffTopic: true };
    }

    if (!result.data.success) {
      throw new Error(result.data.message || "Failed to process query");
    }

    // Expose full CF result for consumer-specific handling
    cartData = result.data.cart;

    // Return extra data for consumers that need it
    return await _finishPipeline({
      inputData,
      courses,
      cartData,
      geminiSucceeded: true,
      semanticResults,
      retrievedPassages,
      vertexAIDocs,
      preferTroubleshooting,
      errorLog,
      stopWords,
      offTopicExamples,
      cfResult: result.data,
    });
  } catch (geminiErr) {
    const isOffTopic =
      geminiErr.message?.includes("off_topic") || geminiErr.message?.includes("not a UE5");

    if (isOffTopic) {
      const examples = offTopicExamples.length > 0
        ? "\n" + offTopicExamples.map((e) => `• "${e}"`).join("\n")
        : "";
      return {
        error: `This doesn't appear to be a UE5 topic. Try describing what you want to learn:${examples}`,
        isOffTopic: true,
      };
    }

    const is429 =
      geminiErr.message?.includes("429") || geminiErr.code === "resource-exhausted";
    devWarn(
      `⚠️ Gemini ${is429 ? "rate limited (429)" : "error"}: ${geminiErr.message}. Falling back to local matching.`
    );

    cartData = {
      diagnosis: {
        problem_summary: inputData.query,
        matched_tag_ids: inputData.detectedTagIds || [],
      },
      objectives: [],
      intent: { systems: [] },
    };

    return await _finishPipeline({
      inputData,
      courses,
      cartData,
      geminiSucceeded: false,
      semanticResults,
      retrievedPassages,
      vertexAIDocs,
      preferTroubleshooting,
      errorLog,
      stopWords,
      offTopicExamples,
      cfResult: null,
    });
  }
}

/**
 * @private Finish the pipeline: course matching → videos → blended path → tracking.
 */
async function _finishPipeline({
  inputData,
  courses,
  cartData,
  geminiSucceeded,
  semanticResults,
  retrievedPassages,
  vertexAIDocs,
  preferTroubleshooting,
  errorLog,
  stopWords,
  offTopicExamples,
  cfResult,
}) {
  cartData.userQuery = inputData.query;
  cartData.retrievedPassages = retrievedPassages;
  cartData._localFallback = !geminiSucceeded;

  // ── Step 3: Shared course → video pipeline ──
  const { matchedCourses, driveVideos, nonVideoItems, allItems } =
    await matchAndFlattenToVideos(cartData, courses, inputData, semanticResults, {
      preferTroubleshooting,
      errorLog,
    });

  if (allItems.length === 0) {
    const examples = offTopicExamples.length > 0
      ? "\n" + offTopicExamples.map((e) => `• "${e}"`).join("\n")
      : "";
    return {
      error: `We couldn't find content matching your query. Try:${examples}`,
      isEmpty: true,
    };
  }

  // ── Step 4: Shared blended path builder ──
  const blended = await buildBlendedPathFromDiagnosis(
    inputData, cartData, driveVideos, nonVideoItems, stopWords
  );

  // ── Track analytics ──
  await trackDiagnosisGenerated(cartData.diagnosis);
  await trackLearningPathGenerated(
    cartData.objectives,
    matchedCourses,
    cartData.validation?.approved
  );

  return {
    cartData,
    matchedCourses,
    driveVideos,
    nonVideoItems,
    blendedPath: blended || null,
    vertexAIDocs,
    retrievedPassages,
    semanticResults,
    geminiSucceeded,
    cfResult,
    error: null,
  };
}

/**
 * Hook that provides the courses list from TagDataContext.
 * Both useProblemFirst and useExploreFirst use this identical pattern.
 */
export function useCourses() {
  const tagData = useTagData();
  return useMemo(() => tagData?.courses || [], [tagData?.courses]);
}
