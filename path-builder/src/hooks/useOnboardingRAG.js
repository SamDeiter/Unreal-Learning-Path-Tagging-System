/**
 * useOnboardingRAG — Client-side orchestrator for the Onboarding RAG pipeline.
 *
 * Flow: CF("plan") → local searchSegmentsHybrid → CF("assemble")
 *
 * Returns { generateRAGPath, ragState, ragResult, ragError }
 */
import { useState, useCallback } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "../services/firebaseConfig";
import { searchSegmentsHybrid } from "../services/segmentSearchService";
import { logOnboardingRAG } from "../services/onboardingTelemetry";
import { devLog, devWarn } from "../utils/logger";

// States: idle → planning → searching → assembling → done | error
const IDLE = "idle";
const PLANNING = "planning";
const SEARCHING = "searching";
const ASSEMBLING = "assembling";
const DONE = "done";
const ERROR = "error";

export default function useOnboardingRAG() {
  const [ragState, setRagState] = useState(IDLE);
  const [ragResult, setRagResult] = useState(null);
  const [ragError, setRagError] = useState(null);

  /**
   * Generate a RAG-grounded learning path via the 3-step pipeline.
   *
   * @param {string} personaString - Free-text persona description
   *   (e.g. "Animation industry, used Maya, wants to learn lighting")
   * @returns {Object|null} The curriculum result, or null on failure
   */
  const generateRAGPath = useCallback(async (personaString) => {
    setRagState(PLANNING);
    setRagResult(null);
    setRagError(null);

    const app = getFirebaseApp();
    const functions = getFunctions(app);
    const queryLearningPath = httpsCallable(functions, "queryLearningPath");
    const startTime = Date.now();

    try {
      // ── STEP 1: PLANNER ── Get search queries + archetype from CF ──
      devLog("[OnboardingRAG] Step 1 — Calling Planner CF...");
      const planRes = await queryLearningPath({
        persona: personaString,
        mode: "onboarding",
        onboardingStep: "plan",
      });

      const planData = planRes.data;
      if (!planData?.success) {
        throw new Error(planData?.error || "Planner failed");
      }

      const { searchQueries = [], archetype = "unknown" } = planData;
      devLog("[OnboardingRAG] Planner returned:", { searchQueries, archetype });

      // ── STEP 2: RETRIEVER ── Local search using segment index ──────
      setRagState(SEARCHING);
      devLog("[OnboardingRAG] Step 2 — Running local segment search...");

      let allPassages = [];
      for (const query of searchQueries.slice(0, 5)) {
        try {
          const results = await searchSegmentsHybrid(query, null, [], 4);
          // Map results to passage format expected by the Assembler
          const mapped = results.map((r) => ({
            videoTitle: r.videoTitle || r.courseTitle || "Unknown",
            courseCode: r.courseCode || "unknown",
            videoId: r.videoKey || r.videoId || "",
            timestamp: r.timestamp || "0:00",
            text: r.topSegments?.[0]?.preview || r.text || "",
          }));
          allPassages.push(...mapped);
        } catch (searchErr) {
          devWarn(`[OnboardingRAG] Search failed for "${query}":`, searchErr.message);
        }
      }

      // Deduplicate by courseCode + videoId
      const seen = new Set();
      allPassages = allPassages.filter((p) => {
        const key = `${p.courseCode}::${p.videoId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      devLog(`[OnboardingRAG] Retrieved ${allPassages.length} unique passages`);

      // ── STEP 3: ASSEMBLER ── Send passages to CF for curriculum ────
      setRagState(ASSEMBLING);
      devLog("[OnboardingRAG] Step 3 — Calling Assembler CF...");

      const assembleRes = await queryLearningPath({
        persona: personaString,
        mode: "onboarding",
        onboardingStep: "assemble",
        archetype,
        passages: allPassages.slice(0, 15), // Cap to avoid huge payloads
      });

      const assembleData = assembleRes.data;
      if (!assembleData?.success) {
        throw new Error(assembleData?.error || "Assembler failed");
      }

      devLog("[OnboardingRAG] Curriculum ready:", assembleData.curriculum?.title);

      // Log telemetry — success
      logOnboardingRAG({
        outcome: "rag_success",
        archetype,
        passagesFound: allPassages.length,
        modulesReturned: (assembleData.curriculum?.modules || []).length,
        searchQueries: searchQueries.length,
        pipelineDurationMs: Date.now() - startTime,
      });

      setRagResult(assembleData);
      setRagState(DONE);
      return assembleData;
    } catch (err) {
      devWarn("[OnboardingRAG] Pipeline error:", err.message);

      // Log telemetry — fallback
      logOnboardingRAG({
        outcome: "rag_fallback",
        errorMessage: err.message || "Unknown error",
        pipelineDurationMs: Date.now() - startTime,
      });

      setRagError(err.message || "Something went wrong");
      setRagState(ERROR);
      return null;
    }
  }, []);

  const resetRAG = useCallback(() => {
    setRagState(IDLE);
    setRagResult(null);
    setRagError(null);
  }, []);

  return {
    generateRAGPath,
    resetRAG,
    ragState,
    ragResult,
    ragError,
    // Expose state constants for consumers
    RAG_STATES: { IDLE, PLANNING, SEARCHING, ASSEMBLING, DONE, ERROR },
  };
}
