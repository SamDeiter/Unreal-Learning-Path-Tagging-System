/**
 * embedQuery — Cloud Function to generate an embedding for a user query.
 * Uses Gemini gemini-embedding-001 (768-dim) with RETRIEVAL_QUERY task type
 * via Vertex AI (ADC-authenticated).
 */
const functions = require("firebase-functions");
const { sanitizeAndValidate } = require("../utils/sanitizeInput");
const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { requireAuth } = require("../utils/authGuard");
const { logApiUsage } = require("../utils/apiUsage");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const vertex = require("../utils/vertex");

const MODEL = "gemini-embedding-001";
const DIMENSION = 768;

exports.embedQuery = functions
  .runWith({
    timeoutSeconds: 15,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    requireAppCheck({ app: context.app, auth: context.auth }, { allowInvalid: false });
    const userId = requireAuth(context);
    const { query } = data;

    const rateLimitCheck = await checkRateLimit(userId, "generation");
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

    const validation = sanitizeAndValidate(query, 300);
    if (validation.blocked) {
      return { success: false, error: validation.reason };
    }

    const payload = {
      content: { parts: [{ text: validation.clean }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: DIMENSION,
    };

    try {
      const response = await vertex.embedContent(MODEL, payload);

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[embedQuery] Vertex error ${response.status}:`, errText.substring(0, 300));
        throw new functions.https.HttpsError("internal", "Embedding API failed");
      }

      const result = await response.json();
      const embedding = result?.embedding?.values;

      if (!embedding || embedding.length !== DIMENSION) {
        throw new functions.https.HttpsError("internal", "Invalid embedding response");
      }
      if (embedding.some((v) => !Number.isFinite(v))) {
        console.error("[embedQuery] Embedding contains NaN or Infinity values");
        throw new functions.https.HttpsError("internal", "Invalid embedding response");
      }

      return { success: true, embedding };
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error("[embedQuery] Error:", err.message);
      throw new functions.https.HttpsError("internal", "Failed to generate embedding");
    } finally {
      logApiUsage(userId, { type: "generation", function: "embedQuery" , firestoreReads: 2, firestoreWrites: 1 });
    }
  });
