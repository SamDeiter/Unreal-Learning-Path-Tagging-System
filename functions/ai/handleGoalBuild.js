/**
 * handleGoalBuild.js — Cloud Function handler for goal-build mode.
 *
 * Receives a broad learner goal, calls the roadmap planner to generate
 * milestones, and returns the skeleton. The frontend fills each milestone
 * with a bespoke micro-path using the existing RAG pipeline.
 */

const { logger } = require("firebase-functions");
const functions = require("firebase-functions");
const { generateRoadmap } = require("./roadmapPlanner");
const { writeSession } = require("./sessions");
const { readSkillState, buildSkillStateSnippet } = require("./skillStateReader");
const { detectMode } = require("./routing");

/**
 * Handle a goal-build request.
 *
 * @param {object} data - Request data containing { query, persona? }
 * @param {object} context - Firebase callable context
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<object>} Roadmap response
 */
async function handleGoalBuild(data, context, apiKey) {
  const { query, persona } = data;

  if (!query || query.trim().length < 5) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "A goal description is required (minimum 5 characters)."
    );
  }

  const uid = context.auth?.uid;
  const learnerState = await readSkillState(uid);
  const learnerContext = buildSkillStateSnippet(learnerState);
  // Routing tiebreaker awareness — callers may choose to honor a re-route.
  // We keep goal-build behavior here; detectMode is invoked so learnerState
  // informs downstream/future routing decisions consistently.
  detectMode(data, learnerState);

  logger.info(JSON.stringify({
    severity: "INFO",
    message: "goal_build_start",
    query,
    persona: persona || "none",
    user: uid || "anonymous",
    hasLearnerContext: !!learnerContext,
  }));

  try {
    const { milestones, title, learnerLevel } = await generateRoadmap(
      query,
      apiKey,
      { persona, learnerContext, learnerState }
    );

    // Determine best persona for this goal
    const resolvedPersona = persona || inferPersona(query);

    const response = {
      success: true,
      mode: "goal-build",
      title,
      learnerLevel,
      persona: resolvedPersona,
      query,
      roadmap: milestones.map((m, i) => ({
        ...m,
        index: i,
        // microPath is filled by the frontend via generateBespokePath
        microPath: null,
        coverage: { status: "pending" },
      })),
      nextBestAction: "Start with the first milestone and complete the first 2-3 steps.",
      generatedAt: new Date().toISOString(),
    };

    const sessionId = await writeSession({
      uid: context.auth?.uid,
      mode: "goalBuild",
      query,
      conversationHistory: Array.isArray(data.conversationHistory) ? data.conversationHistory : [],
      result: response,
      sessionId: data.sessionId,
    });
    response.sessionId = sessionId;

    return response;
  } catch (error) {
    logger.error(JSON.stringify({
      severity: "ERROR",
      message: "goal_build_error",
      error: error.message,
      query,
    }));

    throw new functions.https.HttpsError(
      "internal",
      "Failed to generate learning roadmap. Please try again."
    );
  }
}

/**
 * Infer a default persona from the goal query.
 */
function inferPersona(query) {
  const q = query.toLowerCase();
  if (q.includes("game") || q.includes("gameplay") || q.includes("blueprint")) {
    return "complete_beginner_game_dev";
  }
  if (q.includes("animation") || q.includes("cinematic") || q.includes("film")) {
    return "animator_alex";
  }
  if (q.includes("material") || q.includes("shader") || q.includes("lighting")) {
    return "designer_cpg";
  }
  if (q.includes("archviz") || q.includes("architecture") || q.includes("visualization")) {
    return "architect_amy";
  }
  return "indie_isaac"; // safe default for broad goals
}

module.exports = { handleGoalBuild, inferPersona };
