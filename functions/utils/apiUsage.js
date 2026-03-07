/**
 * Utility: Log API usage for analytics
 * Extracted from index.js during modularization
 */

const admin = require("firebase-admin");

/**
 * Log API usage for rate limiting and analytics.
 * Optionally pass `startTime` (from Date.now()) to auto-compute durationMs.
 * Fails gracefully - logging should never crash the main function.
 */
async function logApiUsage(userId, data, startTime = null) {
  try {
    const db = admin.firestore();
    const entry = {
      userId,
      ...data,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Auto-compute duration if startTime provided
    if (startTime) {
      entry.durationMs = Date.now() - startTime;
    }

    await db.collection("apiUsage").add(entry);
  } catch (error) {
    // Fail silently - logging is non-critical
    console.warn("[WARN] Failed to log API usage:", error.message);
  }
}

module.exports = { logApiUsage };
