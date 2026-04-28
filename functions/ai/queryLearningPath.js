const functions = require("firebase-functions");
const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { requireAuth } = require("../utils/authGuard");
const { logger } = require("firebase-functions");
const { requireAppCheck } = require("../utils/appCheckMiddleware");

// ── Decomposed modules ──────────────────────────────────────────────
const { detectMode } = require("./routing");
const { handleProblemFirst } = require("./handleProblemFirst");
const { handleOnboarding } = require("./handleOnboarding");
const { handleGoalBuild } = require("./handleGoalBuild");

// ============ Main Export ============

exports.queryLearningPath = functions
  .runWith({
    timeoutSeconds: 180,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    requireAppCheck({ app: context.app, auth: context.auth }, { allowInvalid: false });
    const userId = requireAuth(context);

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
      const mode = detectMode(data);
      logger.info(JSON.stringify({ severity: "INFO", message: "query_start", mode, user: userId }));

      if (mode === "goal-build") {
        return await handleGoalBuild(data, context);
      } else if (mode === "problem-first") {
        return await handleProblemFirst(data, context);
      } else if (mode === "onboarding") {
        return await handleOnboarding(data, context);
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
