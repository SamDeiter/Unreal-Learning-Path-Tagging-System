/**
 * Pipeline LLM Stage Runner — unified Gemini call + validate + repair retry.
 *
 * Flow:
 * 1. Check cache → if hit + schema valid → return cached
 * 2. Call Gemini API (responseMimeType: "application/json")
 * 3. Extract JSON from response (handles markdown code blocks)
 * 4. Validate against Zod schema
 * 5. If validation fails → ONE repair retry with Zod error context
 * 6. If repair fails → return structured error
 * 7. Sanitize output (strip HTML, validate URLs)
 * 8. Write to cache on success
 * 9. Record telemetry throughout
 */

const { SCHEMAS } = require("./schemas");
const { getCached, setCache } = require("./cache");
const { sanitizeOutput } = require("./promptVersions");
const { PROMPT_VERSION } = require("./promptVersions");
const { recordUsageRollup } = require("./telemetry");
const vertex = require("../utils/vertex");

/**
 * Normalize a Vertex usageMetadata blob into our internal counter shape.
 * Defaults each field to 0 so missing keys don't poison FieldValue.increment.
 */
function normalizeUsage(usageMetadata = {}) {
  return {
    promptTokens: Number(usageMetadata.promptTokenCount) || 0,
    candidatesTokens: Number(usageMetadata.candidatesTokenCount) || 0,
    cachedTokens: Number(usageMetadata.cachedContentTokenCount) || 0,
  };
}

const MODEL = "gemini-2.5-flash";

/**
 * Extract JSON from LLM response text.
 * Handles: ```json ... ```, ``` ... ```, and raw JSON objects.
 */
function extractJson(text) {
  if (!text) throw new Error("Empty LLM response");

  // Try markdown JSON block
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) return jsonBlockMatch[1].trim();

  // Try plain code block
  const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Try raw JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) return objectMatch[0].trim();

  return text.trim();
}

/**
 * Call the Gemini API via Vertex AI (ADC-authenticated).
 *
 * The `apiKey` parameter is retained for call-site compatibility but ignored —
 * auth is now ADC. Once every caller stops threading apiKey through, drop it.
 *
 * @returns {{text: string, usageMetadata: object}}
 */
async function callGeminiRaw(
  systemPrompt,
  userPrompt,
  apiKey,
  maxTokens = 1024,
  tools = null,
  imagePart = null
) {
  void apiKey;

  const userParts = [{ text: userPrompt }];
  if (imagePart && imagePart.inlineData?.data && imagePart.inlineData?.mimeType) {
    userParts.push(imagePart);
  }

  const payload = {
    contents: [{ parts: userParts }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
    },
  };

  if (tools) {
    payload.tools = tools;
    delete payload.generationConfig.responseMimeType;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    response = await vertex.generateContent(MODEL, payload, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vertex Gemini error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No content returned from Gemini");
  }

  return { text, usageMetadata: data.usageMetadata || {} };
}

/**
 * Build a repair prompt from Zod validation errors.
 */
function buildRepairPrompt(originalResponse, zodErrors, stage) {
  const errorDetails = zodErrors.map((e) => `- ${e.path.join(".")}: ${e.message}`).join("\n");
  return `The previous JSON response for stage "${stage}" had validation errors:
${errorDetails}

Here was the invalid response:
${originalResponse.slice(0, 1500)}

Please return a CORRECTED JSON object that fixes all the errors listed above. Return ONLY valid JSON.`;
}

/**
 * Run a single pipeline stage with full reliability features.
 *
 * @param {object} options
 * @param {string} options.stage - Stage name (must match SCHEMAS key)
 * @param {string} options.systemPrompt - System prompt for Gemini
 * @param {string} options.userPrompt - User prompt for Gemini
 * @param {string} options.apiKey - Gemini API key
 * @param {object} [options.trace] - Telemetry trace object
 * @param {object} [options.cacheParams] - Parameters for cache key (set null to skip caching)
 * @param {number} [options.maxTokens=1024] - Max output tokens
 * @param {Array}  [options.tools=null] - Gemini tools (e.g., Google Search)
 * @returns {{ success: boolean, data?: object, error?: object }}
 */
async function runStage({
  stage,
  systemPrompt,
  userPrompt,
  apiKey,
  trace = null,
  cacheParams = null,
  maxTokens = 1024,
  tools = null,
  imagePart = null,
}) {
  const schema = SCHEMAS[stage];
  if (!schema) {
    throw new Error(`No schema registered for stage "${stage}"`);
  }

  // Start telemetry
  if (trace) trace.startStage(stage);

  try {
    // ── Step 1: Check cache ─────────────────────────────────────────
    if (cacheParams) {
      const cached = await getCached(stage, cacheParams);
      if (cached) {
        if (trace) {
          trace.recordCacheHit();
          trace.endStage({ model: MODEL, cache_hit: true });
        }
        return { success: true, data: cached, cached: true };
      }
    }

    // ── Step 2: Call Gemini ──────────────────────────────────────────
    const { text: rawText, usageMetadata } = await callGeminiRaw(
      systemPrompt,
      userPrompt,
      apiKey,
      maxTokens,
      tools,
      imagePart
    );

    // Track token usage across the whole stage (primary + optional repair).
    const totalUsage = normalizeUsage(usageMetadata);

    // ── Step 3: Extract JSON ────────────────────────────────────────
    const jsonStr = extractJson(rawText);
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error(`JSON parse failed for ${stage}: ${jsonStr.slice(0, 200)}`);
    }

    // ── Step 4: Validate against schema ─────────────────────────────
    const validation = schema.safeParse(parsed);
    if (validation.success) {
      const sanitized = sanitizeOutput(validation.data);
      if (cacheParams) await setCache(stage, cacheParams, sanitized);
      if (trace) {
        trace.recordTokenUsage(totalUsage);
        trace.endStage({ model: MODEL, cache_hit: false });
      }
      // Fire-and-forget daily rollup; do not block response.
      recordUsageRollup({ stage, ...totalUsage }).catch((e) =>
        console.error(JSON.stringify({ severity: "WARNING", message: "usage_rollup_failed", stage, error: e.message }))
      );
      return { success: true, data: sanitized, cached: false, usageMetadata };
    }

    // ── Step 5: ONE repair retry ────────────────────────────────────
    if (trace) trace.recordRetry();
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "schema_validation_failed",
        stage,
        prompt_version: PROMPT_VERSION,
        errors: validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      })
    );

    const repairPrompt = buildRepairPrompt(jsonStr, validation.error.issues, stage);
    const { text: repairText, usageMetadata: repairUsage } = await callGeminiRaw(
      systemPrompt,
      repairPrompt,
      apiKey,
      maxTokens
    );

    // Accumulate repair-call tokens onto the stage total.
    const repairUsageNorm = normalizeUsage(repairUsage);
    totalUsage.promptTokens += repairUsageNorm.promptTokens;
    totalUsage.candidatesTokens += repairUsageNorm.candidatesTokens;
    totalUsage.cachedTokens += repairUsageNorm.cachedTokens;

    const repairJsonStr = extractJson(repairText);
    let repairParsed;
    try {
      repairParsed = JSON.parse(repairJsonStr);
    } catch {
      throw new Error(`Repair JSON parse failed for ${stage}`);
    }

    const repairValidation = schema.safeParse(repairParsed);
    if (repairValidation.success) {
      const sanitized = sanitizeOutput(repairValidation.data);
      if (cacheParams) await setCache(stage, cacheParams, sanitized);
      if (trace) {
        trace.recordTokenUsage(totalUsage);
        trace.endStage({ model: MODEL, cache_hit: false, retries: 1 });
      }
      recordUsageRollup({ stage, ...totalUsage }).catch((e) =>
        console.error(JSON.stringify({ severity: "WARNING", message: "usage_rollup_failed", stage, error: e.message }))
      );
      return { success: true, data: sanitized, cached: false, repaired: true, usageMetadata };
    }

    // ── Step 6: Double failure → structured error ───────────────────
    const structuredError = {
      stage,
      prompt_version: PROMPT_VERSION,
      zodErrors: repairValidation.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
      rawText: repairText.slice(0, 500),
    };
    console.error(
      JSON.stringify({
        severity: "ERROR",
        message: "stage_validation_exhausted",
        ...structuredError,
      })
    );
    if (trace) {
      trace.recordTokenUsage(totalUsage);
      trace.endStage({ model: MODEL, cache_hit: false, retries: 1, error: "validation_exhausted" });
    }
    // Tokens were still spent even on validation failure — record them, plus an error tick.
    recordUsageRollup({ stage, ...totalUsage }).catch((e) =>
      console.error(JSON.stringify({ severity: "WARNING", message: "usage_rollup_failed", stage, error: e.message }))
    );
    recordUsageRollup({ stage, error: true }).catch((e) =>
      console.error(JSON.stringify({ severity: "WARNING", message: "usage_rollup_failed", stage, error: e.message }))
    );
    return { success: false, error: structuredError };

  } catch (err) {
    if (trace) trace.endStage({ model: MODEL, error: err.message });
    recordUsageRollup({ stage, error: true }).catch((e) =>
      console.error(JSON.stringify({ severity: "WARNING", message: "usage_rollup_failed", stage, error: e.message }))
    );
    throw err;
  }
}

module.exports = {
  runStage,
  extractJson,
  callGeminiRaw,
  buildRepairPrompt,
  MODEL,
};
