const functions = require("firebase-functions");
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");

/**
 * PROMPT 3 — LEARNING OBJECTIVE DECOMPOSITION
 * Produce learning objectives that:
 * 1) Fix the current problem
 * 2) Teach transferable diagnostics
 *
 * At least ONE transferable objective is REQUIRED (ANTI-TUTORIAL-HELL)
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
      if (!apiKey) {
        apiKey = functions.config().gemini?.api_key;
      }
      if (!apiKey) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Server configuration error: API Key missing."
        );
      }

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

      const model = "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.3,
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

      let objectivesData;
      try {
        const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : generatedText;
        objectivesData = JSON.parse(jsonStr.trim());
      } catch (_parseError) {
        console.error("[ERROR] Failed to parse Objectives JSON:", generatedText);
        throw new Error("Failed to parse AI response as JSON");
      }

      // CRITICAL: Validate transferable objectives (ANTI-TUTORIAL-HELL)
      if (!Array.isArray(objectivesData.transferable) || objectivesData.transferable.length === 0) {
        console.error("[ERROR] No transferable objectives generated");
        throw new functions.https.HttpsError(
          "failed-precondition",
          "ANTI-TUTORIAL-HELL: At least ONE transferable objective is REQUIRED. The AI failed to generate one."
        );
      }

      await logApiUsage(userId, {
        model: model,
        type: "objectives",
        intentId: intent.intent_id,
        diagnosisId: diagnosis.diagnosis_id,
      });

      return {
        success: true,
        objectives: objectivesData,
      };
    } catch (error) {
      console.error("[ERROR] decomposeLearningObjectives:", error);
      if (error.code) {
        throw error; // Re-throw HttpsError
      }
      throw new functions.https.HttpsError(
        "internal",
        `Failed to generate objectives: ${error.message}`
      );
    }
  });
