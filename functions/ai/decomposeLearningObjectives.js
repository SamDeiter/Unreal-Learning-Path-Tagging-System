const functions = require("firebase-functions");
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");
const { runStage } = require("../pipeline/llmStage");
const { createTrace, isAdmin } = require("../pipeline/telemetry");
const { normalizeQuery } = require("../pipeline/cache");
const { PROMPT_VERSION } = require("../pipeline/promptVersions");

/**
 * PROMPT 3 — LEARNING OBJECTIVE DECOMPOSITION
 * Produce learning objectives that:
 * 1) Fix the current problem
 * 2) Teach transferable diagnostics
 *
 * At least ONE transferable objective is REQUIRED (ANTI-TUTORIAL-HELL)
 *
 * Now uses pipeline/llmStage for schema validation + repair retry + caching.
 */

const SYSTEM_PROMPT = `You are an expert instructional designer for UE5 education.

Your job is to decompose a problem into learning objectives that:
1. Fix the immediate problem (fix_specific)
2. Teach TRANSFERABLE diagnostic skills (transferable)

CRITICAL ANTI-TUTORIAL-HELL REQUIREMENT:
- At least ONE transferable objective is REQUIRED
- Transferable objectives teach skills that apply beyond this specific problem
- They focus on WHY and HOW TO DIAGNOSE, not just steps to follow

Examples of GOOD transferable objectives:
- "Understand how Blueprint execution flow affects object references"
- "Diagnose null reference errors by tracing the execution path"
- "Recognize when to use IsValid checks in Blueprint"

Examples of BAD objectives (too procedural):
- "Click on the node and select Add Breakpoint"
- "Go to Project Settings and change the value"

Return ONLY valid JSON matching this exact schema:
{
  "fix_specific": [
    "string - immediate fix objective 1",
    "string - immediate fix objective 2"
  ],
  "transferable": [
    "string - REQUIRED: transferable skill 1",
    "string - transferable skill 2"
  ]
}

RULES:
- fix_specific: 2-4 objectives that solve THIS problem
- transferable: 1-3 objectives that teach REUSABLE diagnostic skills
- Use action verbs: Understand, Diagnose, Recognize, Evaluate, Apply
- NO purely procedural steps ("click here, then there")

Return ONLY the JSON object.`;

exports.decomposeLearningObjectives = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 60,
    memory: "256MB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";
    const { intent, diagnosis } = data;

    if (!intent || !diagnosis) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Both intent and diagnosis are required."
      );
    }

    const rateLimitCheck = await checkRateLimit(userId, "objectives");
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

      const trace = createTrace(userId, "decomposeLearningObjectives");
      const normalized = normalizeQuery(intent.problem_description || "");

      const userPrompt = `Create learning objectives for this UE5 problem:

INTENT:
- Goal: ${intent.goal || "Solve the problem"}
- Problem: ${intent.problem_description}
- Systems: ${(intent.systems || []).join(", ")}

DIAGNOSIS:
- Summary: ${diagnosis.problem_summary}
- Root Causes: ${(diagnosis.root_causes || []).join("; ")}
- Signals: ${(diagnosis.signals_to_watch_for || []).join("; ")}
- Generalization: ${(diagnosis.generalization_scope || []).join("; ")}

Create learning objectives that:
1. Help them fix THIS specific problem (fix_specific)
2. Teach them to diagnose SIMILAR problems in the future (transferable)

REMEMBER: At least ONE transferable objective is REQUIRED!`;

      const result = await runStage({
        stage: "objectives",
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        apiKey,
        trace,
        cacheParams: { query: normalized, mode: "standalone_objectives" },
      });

      trace.toLog();

      if (!result.success) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "ANTI-TUTORIAL-HELL: Failed to generate valid objectives with transferable skills."
        );
      }

      await logApiUsage(userId, {
        model: "gemini-2.0-flash",
        type: "objectives",
        intentId: intent.intent_id,
        diagnosisId: diagnosis.diagnosis_id,
      });

      const response = {
        success: true,
        objectives: result.data,
        prompt_version: PROMPT_VERSION,
      };

      if (data.debug === true && isAdmin(context)) {
        response._debug = trace.toDebugPayload();
      }

      return response;
    } catch (error) {
      console.error(JSON.stringify({ severity: "ERROR", message: "objectives_error", error: error.message }));
      if (error.code) throw error;
      throw new functions.https.HttpsError(
        "internal",
        `Failed to generate objectives: ${error.message}`
      );
    }
  });
