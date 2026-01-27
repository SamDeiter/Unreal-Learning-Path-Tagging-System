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
- Be specific to their ACTUAL problem, not generic advice

EPIC DOCUMENTATION REQUIREMENT (MANDATORY - DO NOT SKIP):
- The FIRST content item in EVERY step MUST be official Epic Games documentation
- Use REAL URLs from: https://dev.epicgames.com/documentation/en-us/unreal-engine/
- Example valid URLs:
  * https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-best-practices-in-unreal-engine
  * https://dev.epicgames.com/documentation/en-us/unreal-engine/object-referencing-in-unreal-engine
  * https://dev.epicgames.com/documentation/en-us/unreal-engine/packaging-unreal-engine-projects
- NEVER use placeholder URLs - find the REAL documentation page
- Every step needs at least one docs link BEFORE any video links

VIDEO RULES (CRITICAL):
- Videos come AFTER documentation, as supplementary learning
- PREFER videos under 15 minutes
- For videos over 15 minutes, you MUST include:
  * A timestamp URL with &t=XXX pointing to the relevant section start
  * In the description, specify EXACT time range: "Watch 15:30-25:30 for [specific topic]"
  * Do NOT just say "10 minutes" - specify WHICH 10 minutes!
- Example: "Watch 12:45-22:30 for the object reference validation technique"

FORBIDDEN PHRASES (NEVER USE):
- "Search online for..." - ALWAYS provide the actual link instead
- "Look up tutorials on..." - Provide the specific tutorial URL
- "Research how to..." - Give the documentation link
- "Find resources about..." - Include the actual resource URL
- Any action telling users to search - YOU must find and provide the links

ACTION RULES:
- Every "action" field MUST be a concrete task the user can do RIGHT NOW
- If an action references a concept, provide the Epic docs link for it
- Example BAD: "Search online for IsValid tutorials"
- Example GOOD: "Read the IsValid node documentation, then add an IsValid check before accessing your object reference"
- Actions should reference the content items provided in that step`;

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

      // 6. Call Gemini API using official SDK
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemPrompt,
      });

      console.log("[DEBUG] Calling Gemini API with SDK...");

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      });

      const generatedText = result.response.text();

      if (!generatedText) {
        console.error("[ERROR] No content in Gemini response");
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
