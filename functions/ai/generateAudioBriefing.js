const functions = require("firebase-functions");

const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { requireAuth } = require("../utils/authGuard");
const { logApiUsage } = require("../utils/apiUsage");
const { logger } = require("firebase-functions");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const vertex = require("../utils/vertex");

/**
 * generateAudioBriefing - text-mode helpers + (currently disabled) audio path.
 *
 * 2026-04-28: TTS DISABLED during the Vertex AI migration. The previous
 * implementation called `gemini-2.5-flash-preview-tts` via AI Studio, which is
 * not available on Vertex (Epic's enterprise endpoint). All audio modes now
 * return a structured `audio_disabled` error so the UI can degrade gracefully.
 *
 * TODO(audio): pick a replacement and re-enable. Two options on Vertex:
 *   1. Cloud Text-to-Speech (`@google-cloud/text-to-speech`) — different API
 *      surface, no Gemini-style prompt-driven voice control, but available
 *      today on dev-317819 with ADC.
 *   2. Wait for Gemini Live audio / TTS GA on Vertex — same API shape we had,
 *      but no concrete ETA.
 *
 * Text-only modes (deepdive, takeaways, quiz, diagnostic) keep working — they
 * just call Vertex Gemini for text generation.
 */
exports.generateAudioBriefing = functions
  .runWith({
    timeoutSeconds: 300,
    memory: "1GB",
  })
  .https.onCall(async (data, context) => {
    requireAppCheck({ app: context.app, auth: context.auth }, { allowInvalid: false });
    const userId = requireAuth(context);
    const { query, steps } = data;
    const mode = data.mode || "overview";

    if (mode === "step" || mode === "takeaways" || mode === "quiz" || mode === "deepdive") {
      if (!query || !data.stepContent) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Must provide query and stepContent for ${mode} mode.`
        );
      }
    } else if (mode === "diagnostic") {
      if (!query) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Must provide query for diagnostic mode."
        );
      }
    } else {
      if (!query || !steps || !Array.isArray(steps) || steps.length === 0) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Must provide query and steps array."
        );
      }
    }

    const rateLimitCheck = await checkRateLimit(userId, "audioBriefing");
    if (!rateLimitCheck.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded. ${rateLimitCheck.message}`
      );
    }
    const globalCheck = await checkGlobalRateLimit(userId);
    if (!globalCheck.allowed) {
      throw new functions.https.HttpsError("resource-exhausted", `${globalCheck.message}`);
    }

    // ── TTS-MODES (audio output): currently disabled, see file header ──
    if (mode === "step" || mode === "narrate" || mode === "overview") {
      logger.info(
        JSON.stringify({
          severity: "INFO",
          message: "audio_briefing_disabled",
          mode,
          reason: "tts_unavailable_on_vertex_ai",
          userId,
        })
      );
      return {
        success: false,
        disabled: true,
        reason: "audio_disabled",
        message:
          "Audio narration is temporarily disabled while we migrate the TTS backend.",
      };
    }

    try {
      // ── DEEPDIVE MODE ──
      if (mode === "deepdive") {
        const { stepContent, stepCategory, stepTitle } = data;
        if (!stepContent) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "stepContent is required for deepdive mode."
          );
        }

        const userLevel = data.userLevel || "intermediate";
        const existingTakeaways = data.existingTakeaways || [];
        const takeawayContext =
          existingTakeaways.length > 0
            ? `\nThe learner has ALREADY seen these Key Takeaways for this step:\n${existingTakeaways.map((t) => `• ${t}`).join("\n")}\n\nDo NOT repeat this information. Your sections should go DEEPER — explain WHY, HOW, and WHEN these concepts matter, not WHAT they are (the takeaways already cover WHAT to do).\n`
            : "";
        const deepdivePrompt = `You are an expert UE5 instructor creating an in-depth breakdown of a learning step.
The learner is at the ${userLevel.toUpperCase()} level, so tailor depth and vocabulary accordingly.

The learner asked: "${query}"
This is the ${stepCategory || "learning"} step titled "${stepTitle || ""}":

"${stepContent.substring(0, 2000)}"
${takeawayContext}
Create exactly 3 focused sub-sections about the step title: "${stepTitle || ""}". Do NOT introduce concepts from other parts of the source text. Stay anchored to the title topic. Be CONCISE — use bullet points, not paragraphs.

CRITICAL: Each section serves a COMPLETELY DIFFERENT purpose. They must NOT repeat each other:
1. "Key Properties & Settings" = REFERENCE: the exact names and locations of things in UE5
2. "Common Pitfalls" = WARNINGS: mistakes people make and how to avoid them
3. "Try It" = ACTION: a quick hands-on exercise

EXAMPLES OF BAD vs GOOD output:

Example — Redundancy (THE #1 PROBLEM TO AVOID):
BAD: Section 1 says "Line traces detect collisions" and Section 2 says "Incorrect trace settings cause missed targets" — these are the SAME concept rephrased.
GOOD: Section 1 lists "LineTraceByChannel node > Trace Channel dropdown > set to Visibility" (REFERENCE), Section 2 says "Setting Trace Channel to 'Camera' instead of 'Visibility' silently skips static meshes" (WARNING — a specific mistake).

Example — Vague vs Specific:
BAD: "1. Add a Force module to simulate explosion force. • Adjust the Force Strength parameter."
GOOD: "1. In the Emitter Update section, right-click > Add Module > Force. • Set Force Strength to 500 as a starting point for a medium-range explosion."

Return ONLY valid JSON (no markdown, no code fences):
{
  "editorContext": "The specific UE5 editor tool used in this step — one of: Blueprint Editor, Material Editor, Texture Graph, Modeling Mode, Niagara, Sequencer, Level Editor, Animation Blueprint, or Other",
  "sections": [
    {
      "title": "Key Properties & Settings",
      "content": "2-4 bullet points ONLY (every line starts with •). Each bullet names a SPECIFIC property, node, or panel and WHERE to find it. Format: '• PropertyName — found in PanelName > SectionName'. Do NOT explain what it does here (that is the summary's job). This is a REFERENCE CARD. ~60-80 words.",
      "type": "properties"
    },
    {
      "title": "Common Pitfalls",
      "content": "2-4 bullet points ONLY (every line starts with •). Each bullet describes a SPECIFIC MISTAKE and its consequence. Format: '• If you [wrong action], [bad result]. Instead, [correct action].' These must be DIFFERENT information from section 1 — not the same facts rephrased as warnings. ~60-80 words.",
      "type": "pitfalls"
    },
    {
      "title": "Try It",
      "content": "2-3 numbered steps (1. 2. 3.) the learner can follow right now in UE5. Each step MUST reference a property or node from section 1 above. Be specific about menu paths and parameter values. ALWAYS give concrete numbers. ~60-80 words total.",
      "type": "tryit"
    }
  ]
}

RULES:
- ONLY discuss Unreal Engine / game development concepts. NEVER reference real-world physics, hardware, or mechanisms. Explain terms only in UE5 context (Blueprint nodes, sound cues, materials, property panels, editor menus). Avoid C++ code syntax unless the learner explicitly asked about C++.
- CONCISE: EVERY line must start with a bullet (•) or number (1. 2. 3.), NEVER prose sentences or introductory text
- Reference Blueprint node names, property names, and editor paths rather than C++ class names
- Write out number abbreviations in full (e.g. "100 million" not "100M", "1 thousand" not "1K")
- NEVER use vague instructions like "adjust", "tweak", "experiment with", or "try different values". ALWAYS give a specific value or range (e.g. "set to 500", "use a value between 100 and 300")
- In the practical section, every step MUST be actionable with exact menu paths (e.g. "Details > Force > Strength") and concrete parameter values
- SOURCE GROUNDING: ONLY use information present in the provided source text. Do NOT fill gaps with general UE5 knowledge. If the source text does not mention specific values, provide reasonable UE5 defaults.
- SELF-CHECK: Before returning, verify that (1) every practical step has a concrete number or value, (2) all 3 sections discuss the SAME topic from the step title, (3) the practical section references concepts from sections 1 and 2
- DIFFERENTIATION: The practical section must teach the SPECIFIC distinguishing concept in the step title. Ask yourself: "Would this exact exercise also work for a different step on the same general topic?" If yes, it is too generic — rewrite it to be unique to THIS title.
- EDITOR CONTEXT: Start the practical section's FIRST step by naming the specific UE5 editor tool (e.g. "In the Texture Graph…", "In the Blueprint Editor…", "Using Modeling Mode…"). If the step title implies 3D work (mesh, model, shape) but the source is about a 2D tool (Texture Graph, Material Editor), explicitly clarify "This creates a 2D texture pattern, not a 3D mesh."
- SKILL LEVEL: The learner is ${userLevel.toUpperCase()} level. For BEGINNER learners: if the source text uses advanced tools or workflows (e.g. Customizable Objects, Control Rig, Niagara advanced modules, C++ classes), suggest the simplest Blueprint-based alternative that achieves the same learning goal. State "For beginners, use [simpler approach] instead of [advanced tool]." For INTERMEDIATE/ADVANCED learners: use the tools as described in the source.
- TOOL APPROPRIATENESS: If the source content describes an advanced or niche tool (Texture Graph, Customizable Objects, Control Rig) but the learner's query implies a simpler workflow (e.g. "create a sword" = mesh import + Blueprint, not Texture Graph), acknowledge the mismatch in your practical section and redirect: "While this source covers [tool], the standard approach for [query goal] is to use [correct tool]. Here's how..."
- Each section: 60-100 words MAX
- Do NOT use markdown formatting inside the JSON strings`;

        const deepdiveResp = await vertex.generateContent("gemini-2.5-flash", {
          contents: [{ parts: [{ text: deepdivePrompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        });

        if (!deepdiveResp.ok) throw new Error("Deepdive generation failed");
        const deepdiveJson = await deepdiveResp.json();
        const deepdiveText = deepdiveJson.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        let sections = [];
        let editorContext = "";
        try {
          const parsed = JSON.parse(deepdiveText);
          sections = parsed.sections || [];
          editorContext = parsed.editorContext || "";
        } catch {
          console.warn("Failed to parse deepdive JSON, returning raw text");
          sections = [{ title: "Deep Dive", content: deepdiveText, type: "concept" }];
        }

        await logApiUsage(userId, {
          model: "gemini-2.5-flash",
          type: "deepdive",
          query: query.substring(0, 50),
          firestoreReads: 3, firestoreWrites: 2,
        });

        return {
          success: true,
          sections,
          editorContext,
        };
      }

      // ── TAKEAWAYS MODE ──
      if (mode === "takeaways") {
        const { stepContent, stepCategory, stepAction, stepTitle } = data;

        const categoryInstruction =
          {
            prerequisite: `Format as CONCEPTUAL takeaways — "what you need to know before proceeding". Start each with a concept name. Example: "Global Time Dilation controls the speed of all actors, physics, and animations simultaneously."`,
            foundation: `Format as CONCEPTUAL takeaways — "what you need to know before proceeding". Start each with a concept name. Example: "Global Time Dilation controls the speed of all actors, physics, and animations simultaneously."`,
            core: `Format as NUMBERED ACTION STEPS the learner should do. Example: "1. Open the Level Blueprint and add a Set Global Time Dilation node" or "2. Set the Time Dilation value to 0.3 for slow motion"`,
            fix: `Format as NUMBERED ACTION STEPS the learner should do. Example: "1. Open the Level Blueprint and add a Set Global Time Dilation node" or "2. Set the Time Dilation value to 0.3 for slow motion"`,
            practice: `Format as a MINI-CHALLENGE with a success criterion. Example: "Create a Blueprint that toggles slow motion on key press — you'll know it works when all actors visibly slow down but the UI stays responsive."`,
            transfer: `Format as a MINI-CHALLENGE with a success criterion. Example: "Create a Blueprint that toggles slow motion on key press — you'll know it works when all actors visibly slow down but the UI stays responsive."`,
          }[stepCategory] || "";

        const takeawayPrompt = `You are a UE5 instructor highlighting KEY TAKEAWAYS for a learner.

The learner asked: "${query}"
This is a ${stepCategory || "learning"} step titled "${stepTitle || ""}":

"${(stepContent || "").substring(0, 1500)}"
${stepAction ? `\nAction steps from this content:\n"${stepAction.substring(0, 500)}"` : ""}

Generate exactly 3 key takeaways the learner MUST know from this step. Each takeaway should be:
- One concise sentence (under 20 words)
- A SPECIFIC ACTION: must contain a verb like open, set, add, navigate, click, enable, create, or check
- Frame using Blueprint workflows and editor UI, not C++ code syntax
- NOT just restating the problem — tell them WHAT to DO (e.g. "Set NetUpdateFrequency to 100 on your Character Movement Component")
- Include concrete specifics from the content above
${categoryInstruction ? `\nCATEGORY-SPECIFIC FORMAT:\n${categoryInstruction}` : ""}
- CRITICAL DIFFERENTIATION (the Deep Dive section covers properties, pitfalls, and exercises separately — takeaways are SHORT ACTION SUMMARIES only):
  - NEVER start with "Blueprints are...", "Blueprints let you...", "Blueprints use...", or any definition/description
  - BAD: "Blueprints let you create interactive experiences without writing C++ code" (this is a DEFINITION, not an action)
  - GOOD: "Open Window > Blueprints and add an Event BeginPlay node to start scripting gameplay logic" (this is a specific ACTION)
  - BAD: "The visual nature of Blueprints makes it easier to understand game logic" (this is an OPINION)
  - GOOD: "Right-click the Event Graph canvas and search for 'Print String' to test your first Blueprint node" (this is an ACTION)
- ANTI-HALLUCINATION: ONLY reference UE5 tools, properties, and features that are EXPLICITLY mentioned in the content above. Do NOT invent or assume any UE5 features, volume types, or settings that are not in the provided text.
- BLUEPRINT PRECISION: Blueprints ARE visual programming. NEVER say 'without code' or 'no code needed'. Say 'without writing C++ or text-based code'.

Return ONLY a JSON array of 3 strings.`;

        const takeawayResp = await vertex.generateContent("gemini-2.5-flash", {
          contents: [{ parts: [{ text: takeawayPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
        });

        if (!takeawayResp.ok) {
          const err = await takeawayResp.text();
          throw new Error(`Takeaway generation failed: ${err}`);
        }

        const takeawayJson = await takeawayResp.json();
        const takeawayText = takeawayJson.candidates?.[0]?.content?.parts?.[0]?.text || "";

        const match = takeawayText.match(/\[.*\]/s);
        let takeaways = [];
        if (match) {
          try {
            const cleaned = match[0].replace(/,\s*([\]}])/g, "$1");
            takeaways = JSON.parse(cleaned);
          } catch (e) {
            console.warn("Failed to parse takeaways JSON:", e.message);
          }
        }

        if (!Array.isArray(takeaways) || takeaways.length === 0) {
          takeaways = ["Review this step for actionable UE5 specifics"];
        }

        await logApiUsage(userId, {
          model: "gemini-2.5-flash",
          type: "takeaways",
          query: query.substring(0, 50),
          firestoreReads: 3, firestoreWrites: 2,
        });

        return {
          success: true,
          takeaways: takeaways.slice(0, 3),
        };
      }

      // ── QUIZ MODE ──
      if (mode === "quiz") {
        const { stepContent, stepCategory, quizCount } = data;
        const count = Math.min(quizCount || 3, 5);

        const quizPrompt = `You are a UE5 instructor creating a comprehension quiz.

The learner asked: "${query}"
They just studied this ${stepCategory || "learning"} content:

"""
${(stepContent || "").substring(0, 1500)}
"""

Generate exactly ${count} multiple-choice questions that test whether the learner UNDERSTOOD the specific concepts above. Each question should:
- Be DIRECTLY answerable from the content — not generic UE5 trivia
- Reference specific properties, Blueprint nodes, editor settings, or workflows from the content — avoid C++ syntax unless the source content is explicitly about C++
- Have exactly 4 choices (A, B, C, D) — only ONE correct
- Include a 1-sentence explanation for the correct answer
- Write choices as clean readable text — NEVER use (...) or () or code-style signatures in choices

Return ONLY a JSON array:
[{"stem": "What specific property...", "choices": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correct": "B", "explanation": "B is correct because..."}]`;

        const quizResp = await vertex.generateContent("gemini-2.5-flash", {
          contents: [{ parts: [{ text: quizPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        });

        if (!quizResp.ok) {
          const err = await quizResp.text();
          throw new Error(`Quiz generation failed: ${err}`);
        }

        const quizJson = await quizResp.json();
        const quizText = quizJson.candidates?.[0]?.content?.parts?.[0]?.text || "";

        const match = quizText.match(/\[[\s\S]*\]/);
        let questions = [];
        if (match) {
          try {
            const cleaned = match[0].replace(/,\s*([\]}])/g, "$1");
            const parsed = JSON.parse(cleaned);
            questions = parsed.filter(
              (q) =>
                q.stem &&
                q.choices &&
                typeof q.choices === "object" &&
                Object.keys(q.choices).length === 4 &&
                q.correct &&
                ["A", "B", "C", "D"].includes(q.correct)
            );
          } catch (e) {
            console.warn("Failed to parse quiz JSON:", e.message);
          }
        }

        await logApiUsage(userId, {
          model: "gemini-2.5-flash",
          type: "quiz",
          query: query.substring(0, 50),
          firestoreReads: 3, firestoreWrites: 2,
        });

        return {
          success: true,
          questions: questions.slice(0, count),
        };
      }

      // ── DIAGNOSTIC MODE ──
      if (mode === "diagnostic") {
        const diagnosticPrompt = `You are an experienced UE5 instructor creating a diagnostic quiz to ASSESS a learner's existing knowledge before teaching them.

The learner wants to learn about: "${query}"

Generate exactly 4 multiple-choice questions that test whether the learner ALREADY KNOWS key prerequisites and concepts related to this topic. Each question should:
- Test a DISTINCT concept area (e.g., one about fundamentals, one about practical experience, one about UE5-specific knowledge, one about advanced patterns)
- Have exactly 4 choices — only ONE correct
- Include a "concept" field that names the knowledge area being tested (use snake_case, e.g. "actor_replication", "blueprint_networking")
- Include a "difficulty" field: 1 = beginner, 2 = intermediate, 3 = advanced
- Be specific to Unreal Engine 5, not generic programming trivia
- IMPORTANT: Focus questions on Blueprint-based workflows and visual scripting approaches. Only reference C++ if the learner's query explicitly mentions C++ or programming. Frame answers using Blueprint node names, property panels, and editor workflows rather than code syntax.

QUESTION ORDER (strictly follow):
1. BEGINNER (difficulty: 1) — Test basic editor vocabulary: "What panel shows…", "Where do you find…", "What is this called…"
2. INTERMEDIATE (difficulty: 2) — Test working knowledge: "What happens when…", "How do you configure…"
3. ADVANCED (difficulty: 3) — Test implementation experience: "What is the correct workflow for…", "Why would you choose X over Y…"
4. APPLIED (difficulty: 2) — Test practical troubleshooting: "If X isn't working, what should you check…"

Return ONLY a JSON array with this exact format:
[{"q": "What panel shows an Actor's components?", "options": ["Content Browser", "World Outliner", "Details Panel", "Output Log"], "correctIndex": 2, "concept": "editor_panels", "difficulty": 1}]`;

        const diagnosticResp = await vertex.generateContent("gemini-2.5-flash", {
          contents: [{ parts: [{ text: diagnosticPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        });

        if (!diagnosticResp.ok) {
          const err = await diagnosticResp.text();
          throw new Error(`Diagnostic generation failed: ${err}`);
        }

        const diagnosticJson = await diagnosticResp.json();
        const diagnosticText = diagnosticJson.candidates?.[0]?.content?.parts?.[0]?.text || "";

        const dMatch = diagnosticText.match(/\[[\s\S]*\]/);
        let diagnosticQuestions = [];
        if (dMatch) {
          try {
            const cleaned = dMatch[0].replace(/,\s*([\]}])/g, "$1");
            const parsed = JSON.parse(cleaned);
            diagnosticQuestions = parsed.filter(
              (q) =>
                q.q &&
                Array.isArray(q.options) &&
                q.options.length === 4 &&
                typeof q.correctIndex === "number" &&
                q.concept
            );
          } catch (e) {
            console.warn("Failed to parse diagnostic JSON:", e.message);
          }
        }

        await logApiUsage(userId, {
          model: "gemini-2.5-flash",
          type: "diagnostic",
          query: query.substring(0, 50),
          firestoreReads: 3, firestoreWrites: 2,
        });

        return {
          success: diagnosticQuestions.length > 0,
          questions: diagnosticQuestions.slice(0, 5),
          error: diagnosticQuestions.length === 0 ? "No valid questions generated" : null,
        };
      }

      // Any other mode falls through here (overview/narrate handled above as disabled)
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Unsupported mode: ${mode}`
      );
    } catch (error) {
      logger.error(
        JSON.stringify({
          severity: "ERROR",
          message: "audio_briefing_error",
          error: error.message,
        })
      );
      if (error.code) throw error;
      throw new functions.https.HttpsError("internal", "Failed to generate audio briefing. Please try again.");
    }
  });
