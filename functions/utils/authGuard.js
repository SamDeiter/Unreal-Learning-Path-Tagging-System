/**
 * Auth guard utility for Cloud Functions.
 * Rejects unauthenticated or unauthorized calls to protect API quota and sensitive tools.
 */
const functions = require("firebase-functions");

/**
 * Require authentication on a callable function.
 * @param {object} request - The Cloud Function request (v2) or context (v1)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not authenticated
 */
function requireAuth(request) {
  if (!request.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required."
    );
  }
  return request.auth.uid;
}

/**
 * Require admin privileges on a callable function.
 * Supports custom claims (primary) and ADMIN_UID env var (fallback).
 *
 * @param {object} request - The Cloud Function request (v2) or context (v1)
 * @returns {string} The authenticated user's UID
 * @throws {functions.https.HttpsError} if not authenticated or not an admin
 */
function requireAdmin(request) {
  const uid = requireAuth(request);

  // 1. Check custom claim (Standard)
  if (request.auth.token?.admin === true) {
    return uid;
  }

  // 2. Check ADMIN_UID env var (Fallback for migration/bootstrap)
  const adminUids = (process.env.ADMIN_UID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (adminUids.includes(uid)) {
    return uid;
  }

  throw new functions.https.HttpsError(
    "permission-denied",
    "Admin privileges required."
  );
}

module.exports = { requireAuth, requireAdmin };
