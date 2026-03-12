const functions = require("firebase-functions");
const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { requireAuth } = require("../utils/authGuard");
const { logger } = require("firebase-functions");
const { requireAppCheck } = require("../utils/appCheckMiddleware");

// ── Decomposed modules ──────────────────────────────────────────────
const { detectMode } = require("./routing");
const { handleProblemFirst } = require("./handleProblemFirst");
const { handleOnboarding } = require("./handleOnboarding");

// ============ Main Export ============

exports.queryLearningPath = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 180,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    // App Check enforcement (permissive during rollout)
    requireAppCheck({ app: context.app, auth: context.auth }, { allowInvalid: true });
    const userId = requireAuth(context);

    // Rate limiting
    const rateLimitCheck = await checkRateLimit(userId, "query");
    if (!rateLimitCheck.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded. ${rateLimitCheck.message}`
      );
    }
    const globalCheck = await checkGlobalRateLimit(userId);
    if (!globalCheck.allowed) {
      throw new functions.https.HttpsError("resource-exhausted", `${globalCheck.message}`);
    }

    try {
      let apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        apiKey = functions.config().gemini?.api_key;
      }
      if (!apiKey) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Server configuration error: API Key missing."
        );
      }

      const mode = detectMode(data);
      logger.info(JSON.stringify({ severity: "INFO", message: "query_start", mode, user: userId }));

      if (mode === "problem-first") {
        return await handleProblemFirst(data, context, apiKey);
      } else if (mode === "onboarding") {
        return await handleOnboarding(data, context, apiKey);
      } else {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Unable to determine query mode. Provide a query or persona."
        );
      }
    } catch (error) {
      logger.error(
        JSON.stringify({ severity: "ERROR", message: "query_error", error: error.message })
      );
      if (error.code) throw error;
      throw new functions.https.HttpsError("internal", "Failed to process query. Please try again.");
    }
  });
