/**
 * Utility: Log API usage for analytics
 * Extracted from index.js during modularization
 */

const admin = require("firebase-admin");

/**
 * Log API usage for rate limiting and analytics
 * Fails gracefully - logging should never crash the main function
 */
async function logApiUsage(userId, data) {
  try {
    const db = admin.firestore();
    await db.collection("apiUsage").add({
      userId,
      ...data,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // Fail silently - logging is non-critical
    console.warn("[WARN] Failed to log API usage:", error.message);
  }
}

module.exports = { logApiUsage };
