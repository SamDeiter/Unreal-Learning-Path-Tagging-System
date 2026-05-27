/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated calls to protect API quota.
 */
const functions = require("firebase-functions");

/**
 * Bootstrap admin list — used ONLY for initial claim seeding.
 * Once claims are set, this list is irrelevant; future admins
 * are managed by existing admins calling setAdminClaim.
 */
const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * Require authentication on a callable function.
 * @param {object} contextOrRequest - The Cloud Function context (v1) or request (v2)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not authenticated
 */
function requireAuth(contextOrRequest) {
  // contextOrRequest.auth is present on both v1 context and v2 request objects
  // when the user is authenticated.
  if (!contextOrRequest.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }
  return contextOrRequest.auth.uid;
}

/**
 * Require admin access on a callable function.
 * Checks for admin custom claim or bootstrap email list.
 * @param {object} contextOrRequest - The Cloud Function context (v1) or request (v2)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not admin
 */
function requireAdmin(contextOrRequest) {
  requireAuth(contextOrRequest);

  const auth = contextOrRequest.auth;
  const email = (auth.token?.email || "").toLowerCase();
  const isAdmin =
    auth.token?.admin === true || BOOTSTRAP_ADMIN_EMAILS.includes(email);

  if (!isAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Admin access required."
    );
  }
  return auth.uid;
}

module.exports = { requireAuth, requireAdmin, BOOTSTRAP_ADMIN_EMAILS };
