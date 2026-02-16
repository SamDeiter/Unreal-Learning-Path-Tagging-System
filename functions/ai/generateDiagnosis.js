const functions = require("firebase-functions");
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Indirect Injection Guard — strip prompt-injection keywords from user input
// ---------------------------------------------------------------------------
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
// Solution Atoms — loaded once at cold start (zero Firestore cost)
// ---------------------------------------------------------------------------
const SOLUTION_ATOMS = [];

try {
  const atomsDir = path.join(__dirname, "..", "data", "atoms");
  if (fs.existsSync(atomsDir)) {
    const files = fs.readdirSync(atomsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const atom = JSON.parse(fs.readFileSync(path.join(atomsDir, file), "utf8"));
      SOLUTION_ATOMS.push(atom);
    }
    console.log(`[generateDiagnosis] Loaded ${SOLUTION_ATOMS.length} solution atoms`);
  }
} catch (err) {
  console.warn("[generateDiagnosis] Failed to load atoms:", err.message);
}

/**
 * Match detectedTags against Solution Atoms.
 * Returns all atoms where at least one tag matches.
 */
function matchAtoms(detectedTags) {
  if (!detectedTags || detectedTags.length === 0) return [];

  // Normalize detected tags to an array of tag_id strings
  const tagIds = detectedTags.map((t) =>
    typeof t === "string" ? t : t.tag_id || t.id || ""
  ).filter(Boolean);

  if (tagIds.length === 0) return [];

  return SOLUTION_ATOMS.filter((atom) =>
    atom.tags && atom.tags.some((atomTag) => tagIds.includes(atomTag))
  );
}

/**
 * PROMPT 2 — DIAGNOSIS GENERATION
 * Diagnose WHY the problem occurs.
 * Focus on invariants, signals, and root causes.
 */

const SYSTEM_PROMPT = `You are an expert UE5 debugger and educator.

Your job is to diagnose WHY a problem occurs, not just how to fix it.
Focus on:
1. Root causes - the fundamental reasons this happens
2. Signals - what to look for that indicates this problem
3. Variables that matter - what actually affects the outcome
4. Variables that don't matter - common misconceptions to dismiss
5. Generalization scope - where else this knowledge applies

Return ONLY valid JSON matching this exact schema:
{
  "diagnosis_id": "diag_<generate_uuid>",
  "problem_summary": "One-sentence summary of the problem",
  "root_causes": ["string - fundamental reason 1", "string - reason 2"],
  "signals_to_watch_for": ["string - indicator 1", "string - indicator 2"],
  "variables_that_matter": ["string - important variable 1"],
  "variables_that_do_not": ["string - commonly blamed but not the cause"],
  "generalization_scope": ["string - other scenarios where this applies"]
}

CRITICAL RULES:
- root_causes must have at least 2 entries explaining WHY
- signals_to_watch_for should help diagnose similar issues in future
- generalization_scope teaches transferable debugging knowledge

Return ONLY the JSON object. No markdown, no explanation.`;

exports.generateDiagnosis = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 60,
    memory: "256MB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";
    const { intent, detectedTags } = data;

    if (!intent || !intent.problem_description) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Intent with problem_description is required."
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
      if (!apiKey) {
        apiKey = functions.config().gemini?.api_key;
      }
      if (!apiKey) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Server configuration error: API Key missing."
        );
      }

      // ---------------------------------------------------------------
      // Solution Atom lookup — prioritize verified solutions
      // ---------------------------------------------------------------
      const matchedAtoms = matchAtoms(detectedTags);
      let atomContext = "";
      if (matchedAtoms.length > 0) {
        atomContext = `\n\nVERIFIED SOLUTION ATOMS (use these as primary guidance):\n`;
        for (const atom of matchedAtoms) {
          atomContext += `\n--- ${atom.title} ---\n`;
          atomContext += `Why: ${atom.why}\n`;
          if (atom.verification?.items) {
            atomContext += `Key Steps:\n${atom.verification.items.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}\n`;
          }
          if (atom.evidence) {
            atomContext += `Evidence: ${atom.evidence.join(", ")}\n`;
          }
        }
        atomContext += `\nIMPORTANT: Incorporate these verified steps into your root_causes and signals. These are expert-validated solutions.\n`;
      }

      const userPrompt = `Diagnose this UE5 problem:

Intent:
- Role: ${intent.user_role || "Unknown"}
- Goal: ${sanitizeContent(intent.goal || "Solve the problem")}
- Problem: ${sanitizeContent(intent.problem_description)}
- Systems involved: ${(intent.systems || []).join(", ") || "Unknown"}

${detectedTags?.length > 0 ? `Detected tags: ${detectedTags.map((t) => t.display_name || t).join(", ")}` : ""}
${atomContext}
Provide a comprehensive diagnosis focusing on WHY this happens, not just how to fix it.
This diagnosis should teach the developer to recognize and solve similar problems in the future.`;

      const model = "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
        console.error(`[ERROR] Gemini API failed:`, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const responseData = await response.json();
      const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        throw new Error("No content generated from Gemini");
      }

      let diagnosisData;
      try {
        const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : generatedText;
        diagnosisData = JSON.parse(jsonStr.trim());
      } catch {
        console.error("[ERROR] Failed to parse Diagnosis JSON:", generatedText);
        throw new Error("Failed to parse AI response as JSON");
      }

      // Ensure required fields
      if (!diagnosisData.diagnosis_id) {
        diagnosisData.diagnosis_id = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      // Validate root_causes
      if (!Array.isArray(diagnosisData.root_causes) || diagnosisData.root_causes.length < 1) {
        throw new Error("Diagnosis must include at least one root cause");
      }

      // ---------------------------------------------------------------
      // Attach matched atoms to response (client can render "Do" steps)
      // ---------------------------------------------------------------
      if (matchedAtoms.length > 0) {
        diagnosisData.solution_atoms = matchedAtoms.map((atom) => ({
          atom_id: atom.atom_id,
          title: atom.title,
          why: atom.why,
          key_steps: atom.verification?.items || [],
          evidence: atom.evidence || [],
          duration_minutes: atom.duration_minutes,
          prerequisites: atom.prerequisites || [],
          tags: atom.tags,
        }));
      }

      await logApiUsage(userId, {
        model: model,
        type: "diagnosis",
        intentId: intent.intent_id,
        atomsMatched: matchedAtoms.length,
      });

      return {
        success: true,
        diagnosis: diagnosisData,
      };
    } catch (error) {
      console.error("[ERROR] generateDiagnosis:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to generate diagnosis: ${error.message}`
      );
    }
  });
