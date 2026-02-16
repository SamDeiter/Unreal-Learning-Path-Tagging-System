const functions = require("firebase-functions");
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");
const { runStage } = require("../pipeline/llmStage");
const { createTrace, isAdmin } = require("../pipeline/telemetry");
const { PROMPT_VERSION } = require("../pipeline/promptVersions");

/**
 * PROMPT 4 — CURRICULUM VALIDATION
 * Reject learning paths that:
 * - Have no transferable objectives
 * - Are purely step-by-step
 * - Cannot generalize
 *
 * Now uses pipeline/llmStage for schema validation + repair retry.
 */

const SYSTEM_PROMPT = `You are a quality assurance expert for educational content.

Your job is to VALIDATE learning paths to ensure they teach transferable skills, not just procedures.

REJECTION CRITERIA (any of these = reject):
1. NO transferable objectives - The path only teaches "how to fix this one thing"
2. PURELY procedural - Steps like "click here, then there" without explaining WHY
3. CANNOT generalize - No explanation of when/where else this knowledge applies
4. NO conceptual understanding - Doesn't explain the underlying UE5 concept

APPROVAL CRITERIA (all required):
1. At least ONE clear transferable objective
2. Explains WHY the problem occurs, not just how to fix it
3. Teaches diagnostic skills that apply to similar problems
4. Includes conceptual understanding

Return ONLY valid JSON:
{
  "approved": boolean,
  "reason": "string - explanation of decision",
  "issues": ["string - specific issue 1", "string - issue 2"],
  "suggestions": ["string - how to improve if rejected"]
}

Be strict but fair. If the content teaches ANY transferable diagnostic skill, it's likely acceptable.`;

exports.validateCurriculum = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 60,
    memory: "256MB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";
    const { intent, diagnosis, objectives, learningPath } = data;

    if (!objectives) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Learning objectives are required for validation."
      );
    }

    const rateLimitCheck = await checkRateLimit(userId, "validation");
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

      const trace = createTrace(userId, "validateCurriculum");

      const userPrompt = `Validate this UE5 learning curriculum:

PROBLEM:
${intent?.problem_description || "Not provided"}

DIAGNOSIS:
- Summary: ${diagnosis?.problem_summary || "Not provided"}
- Root Causes: ${(diagnosis?.root_causes || []).join("; ") || "Not provided"}

LEARNING OBJECTIVES:
Fix-Specific:
${(objectives.fix_specific || []).map((o, i) => `${i + 1}. ${o}`).join("\n")}

Transferable:
${(objectives.transferable || []).map((o, i) => `${i + 1}. ${o}`).join("\n")}

${
  learningPath
    ? `LEARNING PATH STEPS:\n${learningPath.steps?.map((s) => `- ${s.title}: ${s.description}`).join("\n") || "None"}`
    : ""
}

Does this curriculum meet the anti-tutorial-hell requirements?
- Does it teach WHY, not just HOW?
- Are there transferable diagnostic skills?
- Can the learner apply this to similar problems?`;

      const result = await runStage({
        stage: "validation",
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        apiKey,
        trace,
        cacheParams: null, // Validation should always run fresh
      });

      trace.toLog();

      if (!result.success) {
        throw new functions.https.HttpsError(
          "internal",
          "Failed to validate curriculum after repair retry."
        );
      }

      await logApiUsage(userId, {
        model: "gemini-2.0-flash",
        type: "validation",
        approved: result.data.approved,
      });

      const response = {
        success: true,
        validation: result.data,
        prompt_version: PROMPT_VERSION,
      };

      if (data.debug === true && isAdmin(context)) {
        response._debug = trace.toDebugPayload();
      }

      return response;
    } catch (error) {
      console.error(JSON.stringify({ severity: "ERROR", message: "validation_error", error: error.message }));
      if (error.code) throw error;
      throw new functions.https.HttpsError(
        "internal",
        `Failed to validate curriculum: ${error.message}`
      );
    }
  });
