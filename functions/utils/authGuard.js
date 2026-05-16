/**
 * Auth guard utility for Cloud Functions.
 * Supports both v1 (context) and v2 (request) callable signatures.
 */
const { HttpsError } = require("firebase-functions/v2/https");

const isAdmin = (auth) => {
  if (!auth) return false;
  return auth.token?.admin === true || (process.env.ADMIN_UID && auth.uid === process.env.ADMIN_UID);
};

const requireAuth = (ctxOrReq) => {
  if (!ctxOrReq.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  return ctxOrReq.auth.uid;
};

const requireAdmin = (ctxOrReq) => {
  requireAuth(ctxOrReq);
  if (!isAdmin(ctxOrReq.auth)) throw new HttpsError("permission-denied", "Admin privileges required.");
  return ctxOrReq.auth.uid;
};

module.exports = { isAdmin, requireAuth, requireAdmin };
