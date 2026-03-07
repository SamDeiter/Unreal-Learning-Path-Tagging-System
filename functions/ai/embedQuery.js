/**
 * embedQuery — Cloud Function to generate an embedding for a user query.
 * Uses Gemini text-embedding-004 with RETRIEVAL_QUERY task type.
 */
const functions = require("firebase-functions");
const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
const { sanitizeAndValidate } = require("../utils/sanitizeInput");
const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");

const MODEL = "gemini-embedding-001";
const DIMENSION = 768;

exports.embedQuery = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 15,
    memory: "256MB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";
    const { query } = data;

    // Rate limit check
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

    // Security: sanitize input
    const validation = sanitizeAndValidate(query, 300);
    if (validation.blocked) {
      return { success: false, error: validation.reason };
    }

    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      apiKey = functions.config().gemini?.api_key;
    }
    if (!apiKey) {
      throw new functions.https.HttpsError("internal", "Gemini API key not configured");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${apiKey}`;

    const payload = {
      model: `models/${MODEL}`,
      content: { parts: [{ text: validation.clean }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: DIMENSION,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[embedQuery] API error ${response.status}:`, errText.substring(0, 300));
        throw new functions.https.HttpsError("internal", "Embedding API failed");
      }

      const result = await response.json();
      const embedding = result?.embedding?.values;

      if (!embedding || embedding.length !== DIMENSION) {
        throw new functions.https.HttpsError("internal", "Invalid embedding response");
      }

      return { success: true, embedding };
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error("[embedQuery] Error:", err.message);
      throw new functions.https.HttpsError("internal", "Failed to generate embedding");
    } finally {
      logApiUsage(userId, { type: "generation", function: "embedQuery" });
    }
  });
