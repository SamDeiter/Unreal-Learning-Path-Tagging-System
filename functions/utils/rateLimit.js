/**
 * Utility: Rate limiting helper function
 * Extracted from index.js during modularization
 *
 * Optimized: single Firestore query checks both per-type and global limits.
 */

const admin = require("firebase-admin");

// Rate limits per function type (per user, per minute)
// A single adaptive path generation fires 6+ Cloud Function calls
// (classifySegments x2-3, generateAutoQuiz x1, generateAutoOrdering x1)
// so per-function limits must be generous enough to avoid blocking a
// single user flow.
const RATE_LIMITS = {
  generation: 15,
  classifySegments: 30,
  autoQuiz: 20,
  autoOrdering: 20,
  objectives: 15,
  intentExtraction: 15,
  audioBriefing: 15,
  courseMetadata: 15,
  diagnosis: 15,
  learningPath: 15,
  query: 15,
  validation: 15,
  critique: 20,
};

const GLOBAL_LIMIT = 60; // max 60 total AI calls per user per minute

/**
 * Consolidated rate limit check — single Firestore query for both per-type and global limits.
 *
 * Fetches all recent API calls for the user (last 60s), then checks:
 *   1. Per-type limit (filtered in-memory by `type`)
 *   2. Global limit (total count)
 *
 * @param {string} userId
 * @param {string} type - Function type (e.g., "generation", "classifySegments")
 * @returns {Promise<{allowed: boolean, message?: string}>}
 */
async function checkRateLimits(userId, type = "generation") {
  const db = admin.firestore();
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

  try {
    const recentCalls = await db
      .collection("apiUsage")
      .where("userId", "==", userId)
      .where("timestamp", ">", oneMinuteAgo)
      .get();

    const totalCount = recentCalls.size;

    // Global limit check
    if (totalCount >= GLOBAL_LIMIT) {
      return {
        allowed: false,
        message: `Global rate limit exceeded (${GLOBAL_LIMIT} calls/minute). Please wait.`,
      };
    }

    // Per-type limit check (filter in-memory)
    const limit = RATE_LIMITS[type] || 15;
    let typeCount = 0;
    for (const doc of recentCalls.docs) {
      if (doc.data().type === type) {
        typeCount++;
      }
    }

    if (typeCount >= limit) {
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

/**
 * Legacy per-type rate limit check.
 * @deprecated Use checkRateLimits() instead.
 */
async function checkRateLimit(userId, type = "generation") {
  return checkRateLimits(userId, type);
}

/**
 * Legacy global rate limit check.
 * @deprecated Use checkRateLimits() instead.
 */
async function checkGlobalRateLimit(userId) {
  return checkRateLimits(userId, "generation");
}

module.exports = { checkRateLimit, checkGlobalRateLimit, checkRateLimits };
