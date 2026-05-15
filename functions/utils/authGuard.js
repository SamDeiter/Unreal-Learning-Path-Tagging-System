/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated calls to protect API quota.
 */
const functions = require("firebase-functions");

/**
 * Require authentication on a callable function.
 * @param {object} context - The Cloud Function context
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
 * @param {object} context - The Cloud Function context (v1) or request (v2)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not an admin
 */
function requireAdmin(context) {
  const uid = requireAuth(context);

  // Check custom claim (primary)
  if (context.auth.token?.admin === true) return uid;

  // Check UID fallback (for migration/bootstrap)
  const adminUids = (process.env.ADMIN_UID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (adminUids.includes(uid)) return uid;

  throw new functions.https.HttpsError(
    "permission-denied",
    "Admin privileges required."
  );
}

module.exports = { requireAuth, requireAdmin };
