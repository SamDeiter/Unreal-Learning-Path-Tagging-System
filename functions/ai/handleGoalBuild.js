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

  logger.info(JSON.stringify({
    severity: "INFO",
    message: "goal_build_start",
    query,
    persona: persona || "none",
    user: context.auth?.uid || "anonymous",
  }));

  try {
    const { milestones, title, learnerLevel } = await generateRoadmap(
      query,
      apiKey,
      { persona }
    );

    // Determine best persona for this goal
    const resolvedPersona = persona || inferPersona(query);

    return {
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
