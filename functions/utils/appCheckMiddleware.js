/**
 * App Check Middleware — Server-side enforcement
 *
 * Verifies that requests include a valid App Check token.
 * When `enforceAppCheck` is not used in the function config,
 * this middleware provides a manual enforcement layer.
 *
 * Usage in Cloud Functions:
 *   const { requireAppCheck } = require("../utils/appCheckMiddleware");
 *   // Inside handler:
 *   requireAppCheck(request);
 */
const { HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");

/**
 * Require a valid App Check token on the request.
 * Throws HttpsError if the token is missing or invalid.
 *
 * @param {import("firebase-functions/v2/https").CallableRequest} request
 * @param {Object} [options]
 * @param {boolean} [options.allowInvalid=false] - If true, log a warning but don't reject
 */
function requireAppCheck(request, options = {}) {
  const { allowInvalid = false } = options;

  if (!request.app) {
    if (allowInvalid) {
      logger.warn("App Check token missing — request allowed in permissive mode", {
        uid: request.auth?.uid || "anonymous",
      });
      return;
    }

    logger.warn("App Check token missing — rejecting request", {
      uid: request.auth?.uid || "anonymous",
    });
    throw new HttpsError(
      "failed-precondition",
      "This app requires App Check verification. Please update your client."
    );
  }
}

module.exports = { requireAppCheck };
