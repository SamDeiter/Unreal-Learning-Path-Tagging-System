/**
 * logTelemetry — Lightweight Cloud Function for client-side telemetry.
 *
 * Accepts telemetry data from the client and writes it to the `apiUsage`
 * Firestore collection using the admin SDK (which bypasses security rules).
 *
 * This exists because Firestore security rules (correctly) block direct
 * client-side writes to `apiUsage`.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logApiUsage } = require("../utils/apiUsage");

exports.logTelemetry = onCall(async (request) => {
  const { type, ...rest } = request.data || {};

  if (!type) {
    throw new HttpsError("invalid-argument", "Missing required field: type");
  }

  // Only allow known telemetry types to prevent abuse
  const allowedTypes = ["onboarding_rag"];
  if (!allowedTypes.includes(type)) {
    throw new HttpsError("invalid-argument", `Unknown telemetry type: ${type}`);
  }

  const userId = request.auth?.uid || "anonymous";

  await logApiUsage(userId, { type, ...rest });

  return { success: true };
});
