/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated or unauthorized calls to protect API quota and sensitive operations.
 */
const functions = require("firebase-functions");

/**
 * Bootstrap admin emails for initial seeding.
 * Users in this list are treated as admins even if they don't have the custom claim yet.
 */
const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * Require authentication on a callable function.
 * Works with both v1 (context) and v2 (request) Cloud Functions.
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
 * Checks for either the `admin: true` custom claim or presence in BOOTSTRAP_ADMIN_EMAILS.
 * Works with both v1 (context) and v2 (request) Cloud Functions.
 *
 * @param {object} contextOrRequest - The Cloud Function context (v1) or request (v2)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not an admin
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
