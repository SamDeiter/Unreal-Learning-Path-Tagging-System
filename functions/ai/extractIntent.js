const functions = require("firebase-functions");
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");

/**
 * PROMPT 1 — INTENT EXTRACTION
 * Extract structured intent from a plain-English Unreal Engine problem.
 * Return ONLY valid JSON matching the Intent Object schema.
 */

const SYSTEM_PROMPT = `You are an expert UE5 educator parsing developer problems.

Extract structured intent from a plain-English Unreal Engine problem description.

ANALYZE the problem to identify:
1. user_role: Infer their role from context (e.g., "game developer", "technical artist", "animator")
2. goal: What they're ultimately trying to achieve
3. problem_description: A clear summary of the issue
4. systems: Which UE5 subsystems are involved (e.g., ["Blueprint", "Animation", "Niagara"])
5. constraints: Any mentioned constraints (time, platform, skill level, etc.)

Return ONLY valid JSON matching this exact schema:
{
  "intent_id": "intent_<generate_uuid>",
  "user_role": "string",
  "goal": "string",
  "problem_description": "string",
  "systems": ["string"],
  "constraints": ["string"]
}

IMPORTANT: Return ONLY the JSON object. No markdown, no explanation, just the JSON.`;

exports.extractIntent = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 60,
    memory: "256MB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";
    const { query, personaHint } = data;

    // Input validation
    if (!query || query.trim().length < 10) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Query must be at least 10 characters."
      );
    }

    // Rate limiting
    const rateLimitCheck = await checkRateLimit(userId, "intentExtraction");
    if (!rateLimitCheck.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded. ${rateLimitCheck.message}`
      );
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

      const userPrompt = `Extract intent from this UE5 problem:

"${query}"

${personaHint ? `Context: The user appears to be a ${personaHint}` : ""}

Return the Intent Object JSON.`;

      const model = "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ERROR] Gemini API failed:`, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const responseData = await response.json();
      const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        throw new Error("No content generated from Gemini");
      }

      // Parse JSON from response
      let intentData;
      try {
        const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : generatedText;
        intentData = JSON.parse(jsonStr.trim());
      } catch (_parseError) {
        console.error("[ERROR] Failed to parse Intent JSON:", generatedText);
        throw new Error("Failed to parse AI response as JSON");
      }

      // Ensure required fields
      if (!intentData.intent_id) {
        intentData.intent_id = `intent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      await logApiUsage(userId, {
        model: model,
        type: "intentExtraction",
        query: query.substring(0, 50),
      });

      return {
        success: true,
        intent: intentData,
      };
    } catch (error) {
      console.error("[ERROR] extractIntent:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to extract intent: ${error.message}`
      );
    }
  });
