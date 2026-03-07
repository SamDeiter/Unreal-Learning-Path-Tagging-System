/**
 * Utility: Log API usage for analytics
 * Extracted from index.js during modularization
 */

const admin = require("firebase-admin");

/**
 * Firebase Firestore pricing (Blaze Plan, per 100K operations).
 * Used for cost estimation in the analytics dashboard.
 */
const FIRESTORE_PRICING = {
  readPer100K: 0.06, // $0.06 per 100K reads
  writePer100K: 0.18, // $0.18 per 100K writes
  deletePer100K: 0.02, // $0.02 per 100K deletes
  storagePer_GB: 0.18, // $0.18 per GB/month
};

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

module.exports = { logApiUsage, FIRESTORE_PRICING };
