const functions = require("firebase-functions");
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");

/**
 * classifySegments — Lightweight Gemini relay for Bespoke Path Stage 2.
 *
 * Accepts a fully-formed prompt from the client and returns the raw
 * Gemini response.  No system prompt wrapping — the client owns the
 * prompt so it can include classification + summary instructions.
 */
exports.classifySegments = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 90,
    memory: "256MB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";
    const { prompt } = data;

    if (!prompt || prompt.trim().length < 20) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Prompt must be at least 20 characters."
      );
    }

    const rateLimitCheck = await checkRateLimit(userId, "classifySegments");
    if (!rateLimitCheck.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded. ${rateLimitCheck.message}`
      );
    }

    try {
      let apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) apiKey = functions.config().gemini?.api_key;
      if (!apiKey) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Server configuration error: API Key missing."
        );
      }

      // Direct Gemini call — no system prompt, no schema validation
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini API ${resp.status}: ${errText}`);
      }

      const json = await resp.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";

      await logApiUsage(userId, {
        model: "gemini-2.0-flash",
        type: "classifySegments",
        promptLength: prompt.length,
      });

      return { success: true, text };
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "classifySegments_error",
          error: error.message,
        })
      );
      if (error.code) throw error;
      throw new functions.https.HttpsError(
        "internal",
        `Failed to classify segments: ${error.message}`
      );
    }
  });
