/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated or unauthorized calls to protect API quota and sensitive actions.
 */
const functions = require("firebase-functions");

/**
 * Bootstrap admin list — used for initial claim seeding and fallback access.
 * Centralized here to ensure consistency across administrative functions.
 */
const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * Require authentication on a callable function.
 * Supports both v1 (context) and v2 (request) Cloud Functions.
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
 * Require administrator privileges on a callable function.
 * Validates admin status via 'admin: true' custom claim or BOOTSTRAP_ADMIN_EMAILS list.
 * Supports both v1 (context) and v2 (request) Cloud Functions.
 *
 * @param {object} contextOrRequest - The Cloud Function context (v1) or request (v2)
 * @throws {functions.https.HttpsError} if not an administrator
 */
function requireAdmin(contextOrRequest) {
  const auth = contextOrRequest.auth;
  if (!auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required for administrative actions."
    );
  }

  const email = (auth.token?.email || "").toLowerCase();
  const isAdmin =
    auth.token?.admin === true || BOOTSTRAP_ADMIN_EMAILS.includes(email);

  if (!isAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Administrator privileges required."
    );
  }
}

module.exports = {
  requireAuth,
  requireAdmin,
  BOOTSTRAP_ADMIN_EMAILS
};
