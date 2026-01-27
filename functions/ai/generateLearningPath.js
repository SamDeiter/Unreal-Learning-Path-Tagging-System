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
      const systemPrompt = `You are an expert UE5 educator creating DIAGNOSTIC learning paths.
Your goal is NOT just to fix symptoms, but to teach developers:
1. WHY this problem occurs (root cause understanding)
2. HOW to fix it (practical resolution)
3. HOW TO PREVENT it in the future (best practices)

CRITICAL RULES:
- Create 4 steps: understand (why it happens), diagnose (identify the cause), resolve (fix it), prevent (best practices)
- Step 1 MUST explain the underlying concept - users should understand WHY the error exists
- Step 4 MUST include prevention strategies and best practices
- EVERY step includes official Epic documentation FIRST, then supplementary videos
- Use dev.epicgames.com/documentation URLs
- Be specific to their ACTUAL problem, not generic advice

VIDEO RULES (IMPORTANT):
- PREFER videos under 15 minutes - shorter is better for focused learning
- If a video is over 15 minutes, include a "When to watch" field with timestamp range (e.g., "Watch 5:30-12:00 for the relevant section")
- Include the video duration estimate in the description
- Avoid hour-long tutorial marathons - find the focused clip that solves THIS problem`;

      const userPrompt = `Create an EDUCATIONAL learning path for: "${query}"

${tags.length > 0 ? `Context tags: ${tags.join(", ")}` : ""}

This developer has a specific problem. Your learning path should:
1. UNDERSTAND: Explain the underlying UE5 concept and WHY this error/issue occurs
2. DIAGNOSE: Help them identify the specific cause in THEIR project
3. RESOLVE: Step-by-step fix with practical actions
4. PREVENT: Best practices so this NEVER happens again

Return JSON:
{
  "title": "Learning Path: [problem]",
  "ai_summary": "WHY this happens in plain language",
  "ai_root_cause": "The fundamental reason this occurs",
  "ai_what_you_learn": ["concept 1", "skill 2", "prevention technique"],
  "ai_estimated_time": "X-Y minutes",
  "ai_difficulty": "Beginner/Intermediate/Advanced",
  "ai_hint": "Quick prevention tip they can apply immediately",
  "steps": [
    {
      "number": 1,
      "type": "understand",
      "title": "Why This Happens",
      "description": "The underlying concept",
      "action": "Read and understand the concept",
      "takeaway": "Key insight they should remember",
      "content": [
        {"type": "docs", "title": "Epic Docs: [concept]", "url": "https://dev.epicgames.com/...", "description": "Why this matters"},
        {"type": "video", "title": "Focused Clip Title", "url": "https://youtube.com/watch?v=VIDEO_ID&t=330", "description": "(5 min) Watch from 5:30 - covers the exact concept", "duration": "5 min", "timestamp_start": "5:30"}
      ]
    },
    {
      "number": 2,
      "type": "diagnose",
      "title": "Find the Cause",
      "description": "How to identify the specific issue",
      "action": "Steps to debug",
      "takeaway": "How to diagnose this in future"
    },
    {
      "number": 3,
      "type": "resolve",
      "title": "Fix It",
      "description": "Practical solution",
      "action": "Exact steps to fix"
    },
    {
      "number": 4,
      "type": "prevent",
      "title": "Prevent Future Issues",
      "description": "Best practices",
      "action": "Habits to adopt",
      "takeaway": "How to never have this problem again"
    }
  ]
}

Use REAL Epic documentation URLs and real YouTube video IDs.`;

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
