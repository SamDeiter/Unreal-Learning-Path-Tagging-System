const functions = require("firebase-functions");

// Import utility functions
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");

/**
 * Cloud Function: generateCourseMetadata
 * Generates course metadata and quiz questions from video content
 *
 * Uses Gemini API with server-side key (secure)
 */
exports.generateCourseMetadata = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    // 1. Authentication check (optional - allow for testing)
    const userId = context.auth?.uid || "anonymous";

    const { systemPrompt, userPrompt, temperature = 0.3, model = "gemini-1.5-flash" } = data;

    // 2. Input validation
    if (!systemPrompt || !userPrompt) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "systemPrompt and userPrompt are required."
      );
    }

    // 3. Rate limiting check
    const rateLimitCheck = await checkRateLimit(userId, "courseMetadata");
    if (!rateLimitCheck.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded. ${rateLimitCheck.message}`
      );
    }

    try {
      // 4. Get API key from Secrets
      let apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        apiKey = functions.config().gemini?.api_key;
      }

      if (!apiKey) {
        console.error("[ERROR] GEMINI_API_KEY secret is not set.");
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Server configuration error: API Key missing."
        );
      }

      console.log("[DEBUG] API key found, calling Gemini API...");

      // 5. Call Gemini API
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: 4096,
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ERROR] Gemini API failed: ${response.status} ${response.statusText}`,
          errorText
        );
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        console.error("[ERROR] No content in Gemini response:", JSON.stringify(responseData));
        throw new Error("No content generated from Gemini");
      }

      // 6. Log usage
      await logApiUsage(userId, {
        model: model,
        type: "courseMetadata",
      });

      console.log("[DEBUG] Successfully generated course metadata");

      return {
        success: true,
        textResponse: generatedText,
      };
    } catch (error) {
      console.error("[ERROR] Error details:", JSON.stringify(error, null, 2));
      throw new functions.https.HttpsError(
        "internal",
        `Failed to generate course metadata: ${error.message}`
      );
    }
  });
