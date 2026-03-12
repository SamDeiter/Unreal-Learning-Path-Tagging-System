/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated calls to protect API quota.
 */
const functions = require("firebase-functions");

/**
 * Require authentication on a callable function.
 * @param {object} context - The Cloud Function context
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not authenticated
 */
function requireAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }
  return context.auth.uid;
}

module.exports = { requireAuth };
