/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated calls to protect API quota.
 */
const functions = require("firebase-functions");

/**
 * Bootstrap admin list — used for initial claim seeding and as a fallback
 * for admin-only operations.
 */
const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * Check if the user is an administrator based on custom claims
 * or the bootstrap email list.
 * @param {object} auth - The Cloud Function auth context
 * @returns {boolean}
 */
function isAdmin(auth) {
  if (!auth) return false;
  const email = (auth.token?.email || "").toLowerCase();
  return auth.token?.admin === true || BOOTSTRAP_ADMIN_EMAILS.includes(email);
}

/**
 * Require authentication on a callable function.
 * @param {object} context - The Cloud Function context (v1) or request object (v2)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not authenticated
 */
function requireAuth(context) {
  const auth = context.auth;
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
 * @param {object} context - The Cloud Function context (v1) or request object (v2)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not an admin
 */
function requireAdmin(context) {
  requireAuth(context);
  if (!isAdmin(context.auth)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Administrator privileges required."
    );
  }
  return context.auth.uid;
}

module.exports = {
  isAdmin,
  requireAuth,
  requireAdmin,
  BOOTSTRAP_ADMIN_EMAILS,
};
