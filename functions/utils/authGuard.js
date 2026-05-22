/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated calls to protect API quota.
 */
const functions = require("firebase-functions");

/**
 * Bootstrap admin list — used ONLY for initial claim seeding and fallback.
 * Centralized here to avoid redundancy across functions.
 */
const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * Require authentication on a callable function.
 * Supports both v1 (context) and v2 (request) formats.
 * @param {object} contextOrRequest - The Cloud Function context or request
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
 * Validates via custom 'admin' claim or bootstrap email list.
 * Supports both v1 (context) and v2 (request) formats.
 * @param {object} contextOrRequest - The Cloud Function context or request
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
  const isAdmin =
    auth.token?.admin === true ||
    BOOTSTRAP_ADMIN_EMAILS.includes(email);

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
