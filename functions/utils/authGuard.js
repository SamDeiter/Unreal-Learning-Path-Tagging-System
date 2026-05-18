/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated or unauthorized calls to protect API quota and data.
 */
const functions = require("firebase-functions");

/**
 * Bootstrap admin list — used for initial claim seeding and fallback access.
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
 * Checks for admin custom claim, bootstrap email, or ADMIN_UID env var.
 * @param {object} contextOrRequest - The Cloud Function context or request
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not authorized
 */
function requireAdmin(contextOrRequest) {
  const userId = requireAuth(contextOrRequest);
  const auth = contextOrRequest.auth;
  const email = (auth.token?.email || "").toLowerCase();

  // 1. Check for admin custom claim (primary)
  if (auth.token?.admin === true) {
    return userId;
  }

  // 2. Check bootstrap admin list
  if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) {
    return userId;
  }

  // 3. Check ADMIN_UID env var fallback
  const adminUids = (process.env.ADMIN_UID || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminUids.includes(userId)) {
    return userId;
  }

  throw new functions.https.HttpsError(
    "permission-denied",
    "Admin privileges required."
  );
}

module.exports = {
  requireAuth,
  requireAdmin,
  BOOTSTRAP_ADMIN_EMAILS
};
