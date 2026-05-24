/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated or unauthorized calls to protect API quota and sensitive data.
 */
const functions = require("firebase-functions");

/**
 * Bootstrap admin list — used for initial claim seeding and fallback access.
 * Centralized here as the single source of truth for the application.
 */
const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * Require authentication on a callable function.
 * Supports both v1 (context) and v2 (request) objects.
 * @param {object} contextOrRequest - The Cloud Function context or request
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not authenticated
 */
function requireAuth(contextOrRequest) {
  if (!contextOrRequest.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }
  return contextOrRequest.auth.uid;
}

/**
 * Require admin privileges on a callable function.
 * Validates either the `admin: true` custom claim or the bootstrap email list.
 * Supports both v1 (context) and v2 (request) objects.
 * @param {object} contextOrRequest - The Cloud Function context or request
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not authorized
 */
function requireAdmin(contextOrRequest) {
  if (!contextOrRequest.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }

  const email = (contextOrRequest.auth.token?.email || "").toLowerCase();
  const isAdmin =
    contextOrRequest.auth.token?.admin === true ||
    BOOTSTRAP_ADMIN_EMAILS.includes(email);

  if (!isAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Admin privileges required."
    );
  }

  return contextOrRequest.auth.uid;
}

module.exports = {
  requireAuth,
  requireAdmin,
  BOOTSTRAP_ADMIN_EMAILS
};
