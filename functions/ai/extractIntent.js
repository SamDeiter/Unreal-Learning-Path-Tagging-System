const functions = require("firebase-functions");
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");
const { runStage } = require("../pipeline/llmStage");
const { createTrace, isAdmin } = require("../pipeline/telemetry");
const { normalizeQuery } = require("../pipeline/cache");
const { PROMPT_VERSION } = require("../pipeline/promptVersions");

/**
 * PROMPT 1 — INTENT EXTRACTION
 * Extract structured intent from a plain-English Unreal Engine problem.
 * Return ONLY valid JSON matching the Intent Object schema.
 *
 * Now uses pipeline/llmStage for schema validation + repair retry + caching.
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

    if (!query || query.trim().length < 10) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Query must be at least 10 characters."
      );
    }

    const rateLimitCheck = await checkRateLimit(userId, "intentExtraction");
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

      const trace = createTrace(userId, "extractIntent");
      const normalized = normalizeQuery(query);

      const userPrompt = `Extract intent from this UE5 problem:\n\n"${query}"\n\n${personaHint ? `Context: The user appears to be a ${personaHint}` : ""}\n\nReturn the Intent Object JSON.`;

      const result = await runStage({
        stage: "intent",
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        apiKey,
        trace,
        cacheParams: { query: normalized, mode: "standalone_intent" },
      });

      trace.toLog();

      if (!result.success) {
        throw new functions.https.HttpsError(
          "internal",
          "Failed to extract valid intent after repair retry."
        );
      }

      // Ensure intent_id exists
      if (!result.data.intent_id) {
        result.data.intent_id = `intent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      await logApiUsage(userId, {
        model: "gemini-2.0-flash",
        type: "intentExtraction",
        query: query.substring(0, 50),
      });

      const response = {
        success: true,
        intent: result.data,
        prompt_version: PROMPT_VERSION,
      };

      if (data.debug === true && isAdmin(context)) {
        response._debug = trace.toDebugPayload();
      }

      return response;
    } catch (error) {
      console.error(JSON.stringify({ severity: "ERROR", message: "extractIntent_error", error: error.message }));
      if (error.code) throw error;
      throw new functions.https.HttpsError(
        "internal",
        `Failed to extract intent: ${error.message}`
      );
    }
  });
