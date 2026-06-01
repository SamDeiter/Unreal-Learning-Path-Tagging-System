/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated calls to protect API quota.
 */
const functions = require("firebase-functions");

/**
 * Bootstrap admin list — used ONLY for initial claim seeding.
 * Once claims are set, this list is irrelevant; future admins
 * are managed by existing admins calling this function.
 */
const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * Require authentication on a callable function.
 * @param {object} context - The Cloud Function context (or request for v2)
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

/**
 * Require admin privileges on a callable function.
 * @param {object} requestOrContext - The request (v2) or context (v1)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not authenticated or not an admin
 */
function requireAdmin(requestOrContext) {
  const auth = requestOrContext.auth;
  if (!auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be signed in."
    );
  }

  const email = (auth.token?.email || "").toLowerCase();
  const isAdmin =
    auth.token?.admin === true || BOOTSTRAP_ADMIN_EMAILS.includes(email);

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
  BOOTSTRAP_ADMIN_EMAILS,
};
