const functions = require("firebase-functions");

const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { requireAuth } = require("../utils/authGuard");
const { logApiUsage } = require("../utils/apiUsage");
const { logger } = require("firebase-functions");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const vertex = require("../utils/vertex");

/**
 * Cloud Function: generateCourseMetadata
 * Generates course metadata and quiz questions from video content.
 * Auth via Vertex AI / ADC.
 */
exports.generateCourseMetadata = functions
  .runWith({
    timeoutSeconds: 120,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    requireAppCheck({ app: context.app, auth: context.auth }, { allowInvalid: false });
    const userId = requireAuth(context);

    // gemini-1.5-flash is no longer recommended; default to 2.0-flash on Vertex.
    const { systemPrompt, userPrompt, temperature = 0.3, model = "gemini-2.5-flash" } = data;

    if (!systemPrompt || !userPrompt) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "systemPrompt and userPrompt are required."
      );
    }

    const rateLimitCheck = await checkRateLimit(userId, "courseMetadata");
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
      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: 4096,
        },
      };

      const response = await vertex.generateContent(model, payload);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `[ERROR] Vertex Gemini failed: ${response.status} ${response.statusText}`,
          errorText
        );
        throw new Error(`Vertex Gemini error: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        logger.error("[ERROR] No content in Gemini response:", JSON.stringify(responseData));
        throw new Error("No content generated from Gemini");
      }

      await logApiUsage(userId, {
        model: model,
        type: "courseMetadata",
        firestoreReads: 3, firestoreWrites: 1,
      });

      return {
        success: true,
        textResponse: generatedText,
      };
    } catch (error) {
      logger.error("[ERROR] Error details:", JSON.stringify(error, null, 2));
      throw new functions.https.HttpsError("internal", "Failed to generate course metadata. Please try again.");
    }
  });
