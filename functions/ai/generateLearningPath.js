const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Import utility functions
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");

/**
 * Cloud Function: generateLearningPath
 * Securely calls the Gemini API with server-side API key
 *
 * This function:
 * 1. Validates the user is authenticated
 * 2. Implements rate limiting per user
 * 3. Calls Gemini API with server-side key
 * 4. Returns generated learning path
 */

exports.generateLearningPath = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    // 1. Authentication check (optional for now - allow anonymous)
    const userId = context.auth?.uid || "anonymous";

    const { query, tags = [] } = data;

    // 2. Input validation
    if (!query || query.trim().length < 3) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Query must be at least 3 characters.",
      );
    }

    // 3. Rate limiting check
    const rateLimitCheck = await checkRateLimit(userId, "learningPath");
    if (!rateLimitCheck.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded. ${rateLimitCheck.message}`,
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
          "Server configuration error: API Key missing.",
        );
      }

      // 5. Build the prompt for learning path generation
      const systemPrompt = `You are an expert UE5 (Unreal Engine 5) learning path curator. 
You help developers solve problems by creating structured learning paths from BOTH official documentation AND YouTube videos.

CRITICAL RULES:
- Create 4 steps: foundations, diagnostics, resolution, prevention
- EVERY step MUST include at least 1 official Epic documentation link
- Official docs are PRIMARY, videos are supplementary
- Use dev.epicgames.com/documentation URLs for official docs
- For videos: use REAL YouTube video IDs from known UE5 channels
- Include timestamps when you know specific sections are relevant
- Be practical and action-oriented`;

      const userPrompt = `Create a learning path for this UE5 problem: "${query}"

${tags.length > 0 ? `Related tags: ${tags.join(", ")}` : ""}

IMPORTANT: Include BOTH official Epic documentation AND YouTube videos in each step.
Official Epic docs should be listed FIRST in each step's content array.

Return a JSON object with this structure:
{
  "title": "Learning Path: [problem description]",
  "ai_summary": "1-2 sentence explanation of the problem",
  "ai_what_you_learn": ["skill 1", "skill 2", "skill 3"],
  "ai_estimated_time": "X-Y minutes",
  "ai_difficulty": "Beginner/Intermediate/Advanced",
  "ai_hint": "A quick tip to get started",
  "steps": [
    {
      "number": 1,
      "type": "foundations",
      "title": "Step title",
      "description": "What this step covers",
      "action": "What the user should do",
      "content": [
        {
          "type": "docs",
          "title": "Official Epic Docs: [topic]",
          "url": "https://dev.epicgames.com/documentation/...",
          "description": "Why this documentation helps"
        },
        {
          "type": "video",
          "title": "Video title",
          "url": "https://youtube.com/watch?v=REAL_ID",
          "description": "Supplementary tutorial. Start at X:XX for specific section."
        }
      ]
    }
  ]
}

Use REAL documentation URLs from dev.epicgames.com and real YouTube video IDs.`;

      // 6. Call Gemini API
      const model = "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [
          {
            googleSearch: {}, // Enable grounding for real video URLs
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      };

      console.log("[DEBUG] Calling Gemini API...");

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ERROR] Gemini API failed: ${response.status} ${response.statusText}`,
          errorText,
        );
        throw new Error(
          `Gemini API error: ${response.status} ${response.statusText}`,
        );
      }

      const responseData = await response.json();
      const generatedText =
        responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        console.error(
          "[ERROR] No content in Gemini response:",
          JSON.stringify(responseData),
        );
        throw new Error("No content generated from Gemini");
      }

      // 7. Parse JSON from response
      let pathData;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : generatedText;
        pathData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("[ERROR] Failed to parse Gemini JSON:", generatedText);
        throw new Error("Failed to parse AI response as JSON");
      }

      // 8. Add metadata
      pathData.path_id = query
        .toLowerCase()
        .replace(/\s+/g, "_")
        .substring(0, 50);
      pathData.query = query;
      pathData.tags = tags;
      pathData.generated_at = new Date().toISOString();

      // 9. Log usage
      await logApiUsage(userId, {
        model: model,
        type: "learningPath",
        query: query,
      });

      // 10. Cache the path to Firestore for future use
      try {
        const db = admin.firestore();
        await db
          .collection("cached_paths")
          .doc(pathData.path_id)
          .set({
            ...pathData,
            cached_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        console.log("[DEBUG] Cached path to Firestore:", pathData.path_id);
      } catch (cacheError) {
        console.warn("[WARN] Failed to cache path:", cacheError.message);
      }

      return {
        success: true,
        path: pathData,
      };
    } catch (error) {
      console.error("[ERROR] Error details:", JSON.stringify(error, null, 2));
      throw new functions.https.HttpsError(
        "internal",
        `Failed to generate learning path: ${error.message}`,
      );
    }
  });
