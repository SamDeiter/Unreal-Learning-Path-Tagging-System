const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");
const { runStage } = require("../pipeline/llmStage");
const { createTrace, isAdmin } = require("../pipeline/telemetry");
const { normalizeQuery } = require("../pipeline/cache");
const { PROMPT_VERSION, wrapEvidence } = require("../pipeline/promptVersions");

// Import existing sanitize functions (injection guard from security hardening)
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions|prompts?)/gi,
  /disregard\s+(all\s+)?above/gi,
  /you\s+are\s+now\s+(a|an)\s+/gi,
  /system\s*:\s*/gi,
  /\bact\s+as\b/gi,
  /\bnew\s+instructions?\b/gi,
  /\boverride\s+(previous|system)\b/gi,
  /\breset\s+(your\s+)?(context|instructions?|prompt)\b/gi,
  /\bforget\s+(everything|all|your)\b/gi,
];

function sanitizeContent(text) {
  if (!text || typeof text !== "string") return text || "";
  let cleaned = text;
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[FILTERED]");
  }
  return cleaned;
}

/**
 * PROMPT 2 — DIAGNOSIS
 * Expert-level diagnosis of UE5 problems with RAG grounding.
 *
 * Now uses pipeline/llmStage for schema validation + repair retry + caching.
 */

const SYSTEM_PROMPT = `You are a senior Unreal Engine 5 expert and diagnostician.

Your job is to diagnose UE5 problems with clinical precision, like a doctor diagnosing symptoms.

For each problem, you must:
1. Summarize the problem clearly (problem_summary)
2. Identify ROOT CAUSES — not symptoms, but WHY the problem occurs (root_causes)
3. List diagnostic signals — what to look for to confirm this diagnosis (signals_to_watch_for)
4. Identify variables that matter vs don't — help them focus (variables_that_matter / variables_that_do_not)
5. Generalization scope — where else this pattern appears (generalization_scope)
6. If transcript excerpts are provided, cite them by number

CRITICAL: Your diagnosis should teach the developer WHY this happens, not just how to fix it.
Be specific: mention exact UE5 settings, property names, node types, editor paths.

Return ONLY valid JSON matching this schema:
{
  "diagnosis_id": "diag_<uuid>",
  "problem_summary": "str",
  "root_causes": ["str"],
  "signals_to_watch_for": ["str"],
  "variables_that_matter": ["str"],
  "variables_that_do_not": ["str"],
  "generalization_scope": ["str"],
  "cited_sources": [{"ref": "int", "detail": "str"}]
}`;

/**
 * Find matching atom tags from the tag graph for grounding
 */
function matchAtoms(detectedTags = [], atomGraph = null) {
  if (!atomGraph || !Array.isArray(detectedTags) || detectedTags.length === 0) return [];
  return detectedTags
    .map((tagId) => atomGraph[tagId])
    .filter(Boolean)
    .slice(0, 5);
}

exports.generateDiagnosis = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";
    const { intent, detectedTags, retrievedContext, atomGraph } = data;

    if (!intent) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Intent object is required for diagnosis."
      );
    }

    const rateLimitCheck = await checkRateLimit(userId, "diagnosis");
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

      const trace = createTrace(userId, "generateDiagnosis");
      const normalized = normalizeQuery(intent.problem_description || "");

      // Build atom context for grounding
      const atoms = matchAtoms(detectedTags, atomGraph);
      let atomContext = "";
      if (atoms.length > 0) {
        atomContext = `\n\nKNOWN SOLUTION ATOMS (from verified tag graph):\n${atoms.map((a) => `- ${a.display_name}: ${a.description || ""}`.slice(0, 200)).join("\n")}\nUse these atoms to ground your diagnosis when relevant.`;
      }

      // Build passage context
      let passageContext = "";
      if (Array.isArray(retrievedContext) && retrievedContext.length > 0) {
        const passageTexts = retrievedContext
          .slice(0, 8)
          .map((p, i) => {
            if (p.source === "epic_docs" && p.title) {
              return `[${i + 1}] (Doc: "${p.title}", Section: "${p.section || ""}"): ${String(p.text || "").slice(0, 400)}`;
            }
            return `[${i + 1}] (${p.videoTitle || p.courseCode || ""}, ${p.timestamp || ""}): ${String(p.text || "").slice(0, 400)}`;
          })
          .join("\n");
        passageContext = wrapEvidence(passageTexts);
      }

      const userPrompt = `Diagnose this UE5 problem:

Intent:
- Role: ${intent.user_role || "Unknown"}
- Goal: ${sanitizeContent(intent.goal || "Solve the problem")}
- Problem: ${sanitizeContent(intent.problem_description)}
- Systems involved: ${(intent.systems || []).join(", ") || "Unknown"}

${detectedTags?.length > 0 ? `Detected tags: ${detectedTags.map((t) => t.display_name || t).join(", ")}` : ""}
${atomContext}
${passageContext}
Provide a comprehensive diagnosis focusing on WHY this happens, not just how to fix it.
This diagnosis should teach the developer to recognize and solve similar problems in the future.`;

      const result = await runStage({
        stage: "diagnosis",
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        apiKey,
        trace,
        cacheParams: { query: normalized, mode: "standalone_diagnosis", tags: detectedTags?.slice(0, 5) },
        maxTokens: 1536,
      });

      trace.toLog();

      if (!result.success) {
        throw new functions.https.HttpsError(
          "internal",
          "Failed to generate valid diagnosis after repair retry."
        );
      }

      await logApiUsage(userId, {
        model: "gemini-2.0-flash",
        type: "diagnosis",
        intentId: intent.intent_id,
      });

      const response = {
        success: true,
        diagnosis: result.data,
        prompt_version: PROMPT_VERSION,
      };

      if (data.debug === true && isAdmin(context)) {
        response._debug = trace.toDebugPayload();
      }

      return response;
    } catch (error) {
      console.error(JSON.stringify({ severity: "ERROR", message: "diagnosis_error", error: error.message }));
      if (error.code) throw error;
      throw new functions.https.HttpsError(
        "internal",
        `Failed to generate diagnosis: ${error.message}`
      );
    }
  });
