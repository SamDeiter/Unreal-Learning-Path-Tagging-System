const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { checkRateLimit } = require("../utils/rateLimit");

/**
 * UNIFIED /query ENDPOINT
 * Accepts BOTH:
 * - Persona onboarding requests
 * - Plain-English problem statements
 *
 * Determines mode and routes to appropriate handler
 *
 * Note: We call Gemini directly here instead of importing sub-functions
 * to avoid circular dependencies and keep the flow synchronous.
 */

/**
 * Detect whether this is an onboarding request or a problem-first request
 */
function detectMode(data) {
  const { query, mode, persona, isOnboarding } = data;

  // Explicit mode override
  if (mode === "onboarding" || isOnboarding) return "onboarding";
  if (mode === "problem-first" || mode === "problem") return "problem-first";

  // If persona is set and query looks exploratory, likely onboarding
  if (persona && query) {
    const queryLower = query.toLowerCase();
    const problemIndicators = [
      "error",
      "crash",
      "bug",
      "broken",
      "not working",
      "fails",
      "doesn't",
      "won't",
      "can't",
      "issue",
      "problem",
      "help",
      "fix",
      "debug",
      "null",
      "none",
      "access violation",
    ];

    const isProblem = problemIndicators.some((ind) => queryLower.includes(ind));
    return isProblem ? "problem-first" : "onboarding";
  }

  // Default to problem-first if there's a query
  if (query && query.length > 10) return "problem-first";

  // Default to onboarding if persona only
  if (persona) return "onboarding";

  return "unknown";
}

/**
 * Problem-First Flow:
 * Intent → Diagnosis → Learning Objectives → Validation → Adaptive Cart
 */
async function handleProblemFirst(data, _context, apiKey) {
  const { query, personaHint, detectedTagIds } = data;

  console.log(`[queryLearningPath] Problem-First mode for: "${query.substring(0, 50)}..."`);

  // Step 1: Extract Intent
  const intentResponse = await callGeminiForIntent(query, personaHint, apiKey);
  const intent = intentResponse.intent;

  // Step 2: Generate Diagnosis
  const diagnosisResponse = await callGeminiForDiagnosis(intent, detectedTagIds, apiKey);
  const diagnosis = diagnosisResponse.diagnosis;

  // Step 3: Decompose Learning Objectives
  const objectivesResponse = await callGeminiForObjectives(intent, diagnosis, apiKey);
  const objectives = objectivesResponse.objectives;

  // Step 4: Validate Curriculum (Anti-Tutorial-Hell)
  const validationResponse = await callGeminiForValidation(
    intent,
    diagnosis,
    objectives,
    null,
    apiKey
  );

  if (!validationResponse.validation.approved) {
    console.warn(
      "[queryLearningPath] Curriculum validation failed:",
      validationResponse.validation.reason
    );
    // We still return the result but flag it
  }

  // Step 5: Build Adaptive Learning Cart
  const cart = {
    cart_id: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    mode: "problem-first",
    intent,
    diagnosis,
    objectives,
    validation: validationResponse.validation,
    created_at: new Date().toISOString(),
    // Courses will be matched on the frontend using TagGraphService
  };

  // Cache to Firestore
  try {
    const db = admin.firestore();
    await db
      .collection("adaptive_carts")
      .doc(cart.cart_id)
      .set({
        ...cart,
        cached_at: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (cacheError) {
    console.warn("[queryLearningPath] Failed to cache cart:", cacheError.message);
  }

  return {
    success: true,
    mode: "problem-first",
    cart,
  };
}

/**
 * Onboarding Flow:
 * Delegates to existing generateLearningPath or custom logic
 */
async function handleOnboarding(data, _context) {
  const { persona } = data;

  console.log(`[queryLearningPath] Onboarding mode for persona: ${persona?.id || "unknown"}`);

  // For now, return a structured response that the frontend can use
  // The actual path generation happens on the frontend (Personas.jsx)
  return {
    success: true,
    mode: "onboarding",
    persona,
    message: "Use the Onboarding tab to generate your personalized 10-hour path",
  };
}

// ============ Gemini API Helpers ============

async function callGeminiForIntent(query, personaHint, apiKey) {
  const systemPrompt = `Extract structured intent from a plain-English Unreal Engine problem.
Return ONLY valid JSON:
{
  "intent_id": "intent_<uuid>",
  "user_role": "string",
  "goal": "string",
  "problem_description": "string",
  "systems": ["string"],
  "constraints": ["string"]
}`;

  const userPrompt = `Extract intent from: "${query}"
${personaHint ? `Context: User appears to be a ${personaHint}` : ""}`;

  return await callGemini(systemPrompt, userPrompt, apiKey, "intent");
}

async function callGeminiForDiagnosis(intent, detectedTagIds, apiKey) {
  const systemPrompt = `Diagnose WHY the problem occurs. Focus on root causes and signals.
Return ONLY valid JSON:
{
  "diagnosis_id": "diag_<uuid>",
  "problem_summary": "string",
  "root_causes": ["string"],
  "signals_to_watch_for": ["string"],
  "variables_that_matter": ["string"],
  "variables_that_do_not": ["string"],
  "generalization_scope": ["string"]
}`;

  const userPrompt = `Diagnose: ${intent.problem_description}
Systems: ${(intent.systems || []).join(", ")}
${detectedTagIds?.length ? `Tags: ${detectedTagIds.join(", ")}` : ""}`;

  return await callGemini(systemPrompt, userPrompt, apiKey, "diagnosis");
}

async function callGeminiForObjectives(intent, diagnosis, apiKey) {
  const systemPrompt = `Create learning objectives. At least ONE transferable is REQUIRED.
Return ONLY valid JSON:
{
  "fix_specific": ["string"],
  "transferable": ["string"]
}`;

  const userPrompt = `Create objectives for:
Problem: ${intent.problem_description}
Root Causes: ${(diagnosis.root_causes || []).join("; ")}
Generalization: ${(diagnosis.generalization_scope || []).join("; ")}`;

  return await callGemini(systemPrompt, userPrompt, apiKey, "objectives");
}

async function callGeminiForValidation(intent, diagnosis, objectives, learningPath, apiKey) {
  const systemPrompt = `Validate this curriculum against anti-tutorial-hell rules.
Return ONLY valid JSON:
{
  "approved": boolean,
  "reason": "string",
  "issues": ["string"],
  "suggestions": ["string"]
}`;

  const userPrompt = `Validate:
Problem: ${intent?.problem_description}
Objectives:
- Fix: ${(objectives.fix_specific || []).join("; ")}
- Transferable: ${(objectives.transferable || []).join("; ")}`;

  return await callGemini(systemPrompt, userPrompt, apiKey, "validation");
}

async function callGemini(systemPrompt, userPrompt, apiKey, type) {
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gemini ${type}] API failed:`, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const responseData = await response.json();
  const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!generatedText) {
    throw new Error(`No content from Gemini for ${type}`);
  }

  try {
    const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : generatedText;
    const parsed = JSON.parse(jsonStr.trim());
    return { [type]: parsed };
  } catch (_parseError) {
    console.error(`[Gemini ${type}] Parse failed:`, generatedText);
    throw new Error(`Failed to parse ${type} JSON`);
  }
}

// ============ Main Export ============

exports.queryLearningPath = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 180,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";

    // Rate limiting
    const rateLimitCheck = await checkRateLimit(userId, "query");
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

      // Detect mode
      const mode = detectMode(data);
      console.log(`[queryLearningPath] Detected mode: ${mode}`);

      if (mode === "problem-first") {
        return await handleProblemFirst(data, context, apiKey);
      } else if (mode === "onboarding") {
        return await handleOnboarding(data, context);
      } else {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Unable to determine query mode. Provide a query or persona."
        );
      }
    } catch (error) {
      console.error("[queryLearningPath] Error:", error);
      if (error.code) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", `Failed to process query: ${error.message}`);
    }
  });
