/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated calls to protect API quota.
 */
const functions = require("firebase-functions");

/**
 * Bootstrap admin list — used ONLY for initial claim seeding.
 * Once claims are set, this list is irrelevant; future admins
 * are managed by existing admins.
 */
const BOOTSTRAP_ADMIN_EMAILS = [
  "sam.deiter@epicgames.com",
  "samdeiter@gmail.com",
];

/**
 * Require authentication on a callable function.
 * Supports both v1 (context) and v2 (request) arguments.
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
 * Checks for 'admin' custom claim or presence in bootstrap list.
 * Supports both v1 (context) and v2 (request) arguments.
 * @param {object} contextOrRequest - The Cloud Function context (v1) or request (v2)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not an admin
 */
function requireAdmin(contextOrRequest) {
  const uid = requireAuth(contextOrRequest);
  const token = contextOrRequest.auth.token;
  const email = (token.email || "").toLowerCase();

  const isAdmin = token.admin === true || BOOTSTRAP_ADMIN_EMAILS.includes(email);

  if (!isAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Admin privileges required."
    );
  }
  return uid;
}

module.exports = { requireAuth, requireAdmin, BOOTSTRAP_ADMIN_EMAILS };
