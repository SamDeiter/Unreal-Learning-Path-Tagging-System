/**
 * handleOnboarding.js — Onboarding (First Hour) flow handler.
 *
 * Extracted from queryLearningPath.js for single-responsibility.
 * Supports three modes via data.onboardingStep:
 *   "plan"     → Planner only: returns searchQueries + archetype
 *   "assemble" → Assembler only: builds curriculum from client-provided passages
 *   (default)  → Full pipeline (backward compatible)
 */

const { requireAuth } = require("../utils/authGuard");
const { logApiUsage } = require("../utils/apiUsage");
const { runStage } = require("../pipeline/llmStage");
const { createTrace } = require("../pipeline/telemetry");
const { PROMPT_VERSION } = require("../pipeline/promptVersions");
const { logger } = require("firebase-functions");
const { FALLBACK_CURRICULUM, ONBOARDING_PLANNER_PROMPT, ONBOARDING_ASSEMBLER_PROMPT } = require("./prompts");
const { writeSession } = require("./sessions");
const { readSkillState, buildSkillStateSnippet } = require("./skillStateReader");
const { detectMode } = require("./routing");

// NOTE: ONBOARDING_PLANNER_PROMPT, ONBOARDING_ASSEMBLER_PROMPT, FALLBACK_CURRICULUM
// moved to ./prompts.js

/**
 * fetchOnboardingContext — Retriever stage (mocked).
 * In production, this would query the vector DB (e.g., Pinecone/Firestore Vector Search).
 * For now, returns empty array. Connect to your actual search logic here.
 *
 * @param {string[]} queries - Search queries from the Planner
 * @param {object} _data - Original request data (may contain retrievedContext)
 * @returns {Array} Retrieved passages
 */
async function fetchOnboardingContext(queries, _data) {
  // If the client already provided retrievedContext, use it
  if (Array.isArray(_data.retrievedContext) && _data.retrievedContext.length > 0) {
    return _data.retrievedContext.slice(0, 10).map((p) => ({
      text: String(p.text || "").slice(0, 3000),
      courseCode: String(p.courseCode || ""),
      videoTitle: String(p.videoTitle || ""),
      timestamp: String(p.timestamp || ""),
      source: String(p.source || "transcript"),
      videoId: String(p.videoId || ""),
    }));
  }

  // TODO: Connect to your actual Vector Search logic
  logger.info(
    JSON.stringify({
      severity: "INFO",
      message: "onboarding_retriever_stub",
      queries,
      note: "Vector search not yet connected — returning empty context",
    })
  );

  return [];
}

/**
 * Onboarding Flow — 3-Stage RAG Pipeline (Client-Side Hybrid)
 *
 * Supports three modes via data.onboardingStep:
 *   "plan"     → Planner only: returns searchQueries + archetype
 *   "assemble" → Assembler only: builds curriculum from client-provided passages
 *   (default)  → Full pipeline (backward compatible)
 *
 * The client orchestrates:  CF plan → local search → CF assemble
 */
async function handleOnboarding(data, context, apiKey) {
  const { persona, onboardingStep } = data;
  const userId = requireAuth(context);
  const trace = createTrace(userId, "onboarding_gen");

  const learnerState = await readSkillState(userId);
  const learnerContext = buildSkillStateSnippet(learnerState);
  const learnerBlock = learnerContext ? `\n\nLEARNER CONTEXT:\n${learnerContext}\n` : "";
  detectMode(data, learnerState);

  if (!persona || String(persona).trim().length < 5) {
    const noPersonaResponse = {
      success: true,
      mode: "onboarding",
      prompt_version: PROMPT_VERSION,
      archetype: "unknown",
      curriculum: FALLBACK_CURRICULUM,
      fallback: true,
      message: "Tell us more about your goals for a personalized path!",
    };
    const noPersonaSessionId = await writeSession({
      uid: userId,
      mode: "onboarding",
      query: persona || null,
      conversationHistory: [],
      result: noPersonaResponse,
      sessionId: data.sessionId,
    });
    return { ...noPersonaResponse, sessionId: noPersonaSessionId };
  }

  try {
    // ────────────────────────────────────────────────────────────────
    // STEP "plan" — Planner only (returns queries + archetype)
    // ────────────────────────────────────────────────────────────────
    if (onboardingStep === "plan") {
      const plannerResult = await runStage({
        stage: "onboarding_planner",
        systemPrompt: ONBOARDING_PLANNER_PROMPT + learnerBlock,
        userPrompt: `User Persona: "${String(persona).slice(0, 500)}"`,
        apiKey,
        trace,
        cacheParams: { persona: String(persona).slice(0, 200), mode: "onboarding_planner" },
      });

      trace.toLog();

      if (!plannerResult.success) {
        console.warn(
          JSON.stringify({
            severity: "WARNING",
            message: "onboarding_planner_failed",
            error: plannerResult.error,
          })
        );
        return { success: false, mode: "onboarding", step: "plan", error: "Planner failed" };
      }

      const planResponse = {
        success: true,
        mode: "onboarding",
        step: "plan",
        prompt_version: PROMPT_VERSION,
        searchQueries: plannerResult.data.searchQueries || [],
        archetype: plannerResult.data.archetype || "unknown",
      };
      const planSessionId = await writeSession({
        uid: userId,
        mode: "onboarding",
        query: persona,
        conversationHistory: [],
        result: planResponse,
        sessionId: data.sessionId,
      });
      return { ...planResponse, sessionId: planSessionId };
    }

    // ────────────────────────────────────────────────────────────────
    // STEP "assemble" — Assembler only (takes client-provided passages)
    // ────────────────────────────────────────────────────────────────
    if (onboardingStep === "assemble") {
      const { passages = [], archetype = "unknown" } = data;

      // Build context block from client-provided passages
      let contextBlock = "";
      if (passages.length > 0) {
        contextBlock = passages
          .map(
            (p, i) =>
              `[${i + 1}] Video: "${p.videoTitle || p.courseTitle || "Unknown"}" (Course: ${p.courseCode || "unknown"}, ID: ${p.videoId || "unknown"}, Timestamp: ${p.timestamp || "0:00"})\n${p.text || p.preview || ""}`
          )
          .join("\n\n");
      } else {
        contextBlock =
          "No specific video content was retrieved. Create a general curriculum based on the archetype.";
      }

      const assemblerResult = await runStage({
        stage: "onboarding_path",
        systemPrompt: ONBOARDING_ASSEMBLER_PROMPT + learnerBlock,
        userPrompt: `Create a path for a ${archetype}.\n\nUser says: "${String(persona).slice(0, 300)}"\n\nAvailable Content:\n${contextBlock}`,
        apiKey,
        trace,
        cacheParams: { persona: String(persona).slice(0, 200), mode: "onboarding_assembler" },
      });

      trace.toLog();

      logApiUsage(userId, {
        model: "gemini-2.0-flash",
        type: "onboarding_rag",
        archetype,
        passageCount: passages.length,
        firestoreReads: 2, firestoreWrites: 1,
      });

      const curriculum =
        assemblerResult.success && assemblerResult.data
          ? assemblerResult.data
          : FALLBACK_CURRICULUM;

      const assembleResponse = {
        success: true,
        mode: "onboarding",
        step: "assemble",
        prompt_version: PROMPT_VERSION,
        archetype,
        curriculum,
        fallback: !assemblerResult.success,
        message: assemblerResult.success
          ? `Your personalized First Hour path is ready — archetype: ${archetype}`
          : "Generated a general path — retrieval had limited results.",
      };
      const assembleSessionId = await writeSession({
        uid: userId,
        mode: "onboarding",
        query: persona,
        conversationHistory: [],
        result: assembleResponse,
        sessionId: data.sessionId,
      });
      return { ...assembleResponse, sessionId: assembleSessionId };
    }

    // ────────────────────────────────────────────────────────────────
    // DEFAULT — Full pipeline (backward compatible)
    // ────────────────────────────────────────────────────────────────
    const plannerResult = await runStage({
      stage: "onboarding_planner",
      systemPrompt: ONBOARDING_PLANNER_PROMPT + learnerBlock,
      userPrompt: `User Persona: "${String(persona).slice(0, 500)}"`,
      apiKey,
      trace,
      cacheParams: { persona: String(persona).slice(0, 200), mode: "onboarding_planner" },
    });

    if (!plannerResult.success) {
      console.warn(
        JSON.stringify({
          severity: "WARNING",
          message: "onboarding_planner_failed",
          error: plannerResult.error,
        })
      );
      const plannerFailResponse = {
        success: true,
        mode: "onboarding",
        prompt_version: PROMPT_VERSION,
        archetype: "unknown",
        curriculum: FALLBACK_CURRICULUM,
        fallback: true,
        message: "Couldn't personalize your path right now — here's a general starting point.",
      };
      const plannerFailSessionId = await writeSession({
        uid: userId,
        mode: "onboarding",
        query: persona,
        conversationHistory: [],
        result: plannerFailResponse,
        sessionId: data.sessionId,
      });
      return { ...plannerFailResponse, sessionId: plannerFailSessionId };
    }

    const { searchQueries, archetype } = plannerResult.data;

    const passages = await fetchOnboardingContext(searchQueries || [], data);

    let contextBlock = "";
    if (passages.length > 0) {
      contextBlock = passages
        .map(
          (p, i) =>
            `[${i + 1}] Video: "${p.videoTitle}" (Course: ${p.courseCode}, ID: ${p.videoId || "unknown"}, Timestamp: ${p.timestamp || "0:00"})\n${p.text}`
        )
        .join("\n\n");
    } else {
      contextBlock =
        "No specific video content was retrieved. Create a general curriculum based on the archetype.";
    }

    const assemblerResult = await runStage({
      stage: "onboarding_path",
      systemPrompt: ONBOARDING_ASSEMBLER_PROMPT + learnerBlock,
      userPrompt: `Create a path for a ${archetype}.\n\nUser says: "${String(persona).slice(0, 300)}"\n\nAvailable Content:\n${contextBlock}`,
      apiKey,
      trace,
      cacheParams: { persona: String(persona).slice(0, 200), mode: "onboarding_assembler" },
    });

    trace.toLog();

    logApiUsage(userId, {
      model: "gemini-2.0-flash",
      type: "onboarding_rag",
      archetype,
      passageCount: passages.length,
      firestoreReads: 2, firestoreWrites: 1,
    });

    const curriculum =
      assemblerResult.success && assemblerResult.data ? assemblerResult.data : FALLBACK_CURRICULUM;

    const fullResponse = {
      success: true,
      mode: "onboarding",
      prompt_version: PROMPT_VERSION,
      archetype,
      curriculum,
      debug_queries: searchQueries,
      fallback: !assemblerResult.success,
      message: assemblerResult.success
        ? `Your personalized First Hour path is ready — archetype: ${archetype}`
        : "Generated a general path — retrieval had limited results.",
    };
    const fullSessionId = await writeSession({
      uid: userId,
      mode: "onboarding",
      query: persona,
      conversationHistory: [],
      result: fullResponse,
      sessionId: data.sessionId,
    });
    return { ...fullResponse, sessionId: fullSessionId };
  } catch (err) {
    logger.error(
      JSON.stringify({ severity: "ERROR", message: "onboarding_error", error: err.message })
    );
    const errorResponse = {
      success: true,
      mode: "onboarding",
      prompt_version: PROMPT_VERSION,
      archetype: "unknown",
      curriculum: FALLBACK_CURRICULUM,
      fallback: true,
      persona,
      message:
        "Here's a getting-started path. We couldn't personalize it right now — try again shortly.",
    };
    const errorSessionId = await writeSession({
      uid: userId,
      mode: "onboarding",
      query: persona,
      conversationHistory: [],
      result: errorResponse,
      sessionId: data.sessionId,
    });
    return { ...errorResponse, sessionId: errorSessionId };
  }
}

module.exports = { handleOnboarding, fetchOnboardingContext };
