/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated or unauthorized calls to protect API quota and sensitive data.
 */
const functions = require("firebase-functions");

/**
 * Centralized list of bootstrap admin emails.
 * Used for initial claim seeding and emergency fallback.
 */
const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * Require authentication on a callable function.
 * Supports both v1 (context) and v2 (request) objects.
 *
 * @param {object} contextOrRequest - The Cloud Function context (v1) or request (v2)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not authenticated
 */
function requireAuth(contextOrRequest) {
  const auth = contextOrRequest.auth;
  if (!auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }
  return auth.uid;
}

/**
 * Require admin privileges on a callable function.
 * Validates via custom claims or bootstrap email list.
 * Supports both v1 (context) and v2 (request) objects.
 *
 * @param {object} contextOrRequest - The Cloud Function context (v1) or request (v2)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not authorized
 */
function requireAdmin(contextOrRequest) {
  const auth = contextOrRequest.auth;
  if (!auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }

  const email = (auth.token?.email || "").toLowerCase();
  const isAdmin = auth.token?.admin === true || BOOTSTRAP_ADMIN_EMAILS.includes(email);

  if (!isAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Admin privileges required."
    );
  }

  return auth.uid;
}

module.exports = {
  requireAuth,
  requireAdmin,
  BOOTSTRAP_ADMIN_EMAILS
};
