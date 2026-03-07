/**
 * Utility: Rate limiting helper function
 * Extracted from index.js during modularization
 */

const admin = require("firebase-admin");

/**
 * Rate limiting helper
 * Checks if user has exceeded rate limits
 */
async function checkRateLimit(userId, type = "generation") {
  const db = admin.firestore();
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  try {
    // Get user's recent API calls for THIS specific function type
    const recentCalls = await db
      .collection("apiUsage")
      .where("userId", "==", userId)
      .where("type", "==", type)
      .where("timestamp", ">", new Date(oneMinuteAgo))
      .get();

    const callCount = recentCalls.size;

    // Rate limits per function type (per user, per minute)
    // A single adaptive path generation fires 6+ Cloud Function calls
    // (classifySegments x2-3, generateAutoQuiz x1, generateAutoOrdering x1)
    // so per-function limits must be generous enough to avoid blocking a
    // single user flow.
    const RATE_LIMITS = {
      generation: 15, // generic generation (embedQuery, vectorSearch)
      classifySegments: 30, // sequencing + hybrid fallback can fire 3-4x per path
      autoQuiz: 20, // quiz gen per step
      autoOrdering: 20, // category ordering
      objectives: 15, // decomposeLearningObjectives
      intentExtraction: 15, // extractIntent
      audioBriefing: 15, // generateAudioBriefing
      courseMetadata: 15, // generateCourseMetadata
      diagnosis: 15, // generateDiagnosis
      learningPath: 15, // generateLearningPath
      query: 15, // queryLearningPath
      validation: 15, // validateCurriculum
      critique: 20, // critique/feedback calls
    };

    const limit = RATE_LIMITS[type] || 15;

    if (callCount >= limit) {
      return {
        allowed: false,
        message: `You can make ${limit} ${type} requests per minute. Please wait.`,
      };
    }

    return { allowed: true };
  } catch (error) {
    // Index may still be building - allow request to proceed
    console.log("Rate limit check skipped (index may be building):", error.message);
    return { allowed: true };
  }
}

module.exports = { checkRateLimit };
