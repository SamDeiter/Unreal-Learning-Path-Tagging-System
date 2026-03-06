const functions = require("firebase-functions");

const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");

/**
 * generateAudioBriefing - NotebookLM-style audio overview for a learning path.
 *
 * Pipeline:
 * 1. Accept learning path data (steps, summaries, user query)
 * 2. Generate a 2-speaker dialog script via Gemini Flash
 * 3. Synthesize audio via Gemini 2.5 Flash Preview TTS (multi-speaker)
 * 4. Upload WAV to Firebase Storage and return download URL
 */
exports.generateAudioBriefing = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";
    const { query, steps } = data;
    const mode = data.mode || "overview";

    // Validate based on mode
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

    try {
      let apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) apiKey = functions.config().gemini?.api_key;
      if (!apiKey) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Server configuration error: API Key missing."
        );
      }

      // ── STEP MODE: single-step short briefing ──
      if (mode === "step") {
        const { stepContent, stepCategory, stepTitle } = data;
        if (!stepContent) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "stepContent is required for step mode."
          );
        }

        // Generate a single-speaker explanation (100-120 words, ~30-40sec audio)
        // Adapt tone based on position in the learning path
        const position = data.stepPosition || "middle"; // first | middle | last
        const sourceLinks = data.sourceLinks || []; // [{title, url}]

        let positionInstruction;
        if (position === "first") {
          positionInstruction = `This is the FIRST step. Start with a brief, warm greeting like "Alright, let's dive in." Then set up the context for what you'll cover.`;
        } else if (position === "last") {
          const sourceNames = sourceLinks.map((s) => s.title).join(", ");
          positionInstruction = `CRITICAL: Do NOT say "hey", "hey there", "hello", "hi", or ANY greeting. Jump straight into the content as if continuing a conversation.
This is the LAST step. After your explanation, wrap up with something like: "And if you want to go deeper, check out the source materials linked below${sourceNames ? ` — especially ${sourceNames}` : ""}." End with brief encouragement.`;
        } else {
          positionInstruction = `CRITICAL: Do NOT say "hey", "hey there", "hello", "hi", or ANY greeting. Do NOT introduce yourself. Jump straight into the content as if you're continuing mid-conversation. Start with a transition like "Next up..." or "Now let's look at..." or just dive right into the topic.`;
        }

        const stepPrompt = `You are a friendly UE5 instructor recording audio narration for a step-by-step learning path.

The learner asked: "${query}"
This is the ${stepCategory || "learning"} step titled "${stepTitle || ""}":

"${stepContent.substring(0, 800)}"

${positionInstruction}

In about 100-120 words (4-6 sentences), explain what the learner should understand and focus on in this step. Be specific to the actual content — reference concrete UE5 concepts, classes, functions, or workflows mentioned in the text. Speak directly to the learner using "you".

IMPORTANT:
- STAY ON TOPIC: Your explanation must DIRECTLY address the topic in the step title: "${stepTitle || ""}". Do NOT drift to related but different concepts from the source text. If the source content covers multiple topics, focus ONLY on the one matching the title.
- ONLY discuss Unreal Engine / game development concepts. NEVER reference real-world physics, hardware, or physical mechanisms. If a term (e.g. "muzzle report", "recoil") appears in the source text, explain it ONLY in the context of implementing it in UE5 (sound cues, animations, Blueprint nodes, property panels, editor workflows), NOT what it means in the real world.
- ALWAYS explain using Blueprint nodes, property panels, and editor UI. Avoid C++ code references unless the learner's query explicitly asks about C++.
- If the source content is ambiguous or thin, stay within UE5 context. Do NOT fill gaps with real-world knowledge.
- Do NOT tell the learner to "search the Content Browser" or "look for X in the editor" — instead explain what the concept IS and how it works.
- Focus on UNDERSTANDING, not on generic navigation instructions.
- Give practical context: WHY this concept matters in UE5 and WHEN you'd use it.
- Do NOT use any markdown, bullet points, or formatting. Just plain conversational text.`;

        const stepScriptUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const stepScriptResp = await fetch(stepScriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: stepPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 256 },
          }),
        });

        if (!stepScriptResp.ok) throw new Error("Step script generation failed");
        const stepScriptJson = await stepScriptResp.json();
        const stepScript = stepScriptJson.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // TTS — single speaker (no multiSpeakerVoiceConfig, just voiceConfig)
        const stepTtsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
        const stepTtsBody = {
          contents: [{ parts: [{ text: stepScript }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: data.voiceName || "Kore" },
              },
            },
          },
        };

        const stepTtsResp = await fetch(stepTtsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stepTtsBody),
        });

        if (!stepTtsResp.ok) {
          const errBody = await stepTtsResp.text();
          console.log(
            JSON.stringify({
              severity: "ERROR",
              message: "step_tts_api_error",
              status: stepTtsResp.status,
              body: errBody.substring(0, 500),
            })
          );
          throw new Error(`Step TTS failed (${stepTtsResp.status}): ${errBody.substring(0, 200)}`);
        }
        const stepTtsJson = await stepTtsResp.json();
        const stepAudioPart = stepTtsJson.candidates?.[0]?.content?.parts?.[0];
        const stepAudioData = stepAudioPart?.inlineData || stepAudioPart?.inline_data;
        if (!stepAudioData?.data) throw new Error("No audio data in step TTS response");

        // Convert PCM to WAV
        const pcm = Buffer.from(stepAudioData.data, "base64");
        const sr = 24000;
        const bps = 16;
        const ch = 1;
        const hdr = Buffer.alloc(44);
        hdr.write("RIFF", 0);
        hdr.writeUInt32LE(36 + pcm.length, 4);
        hdr.write("WAVE", 8);
        hdr.write("fmt ", 12);
        hdr.writeUInt32LE(16, 16);
        hdr.writeUInt16LE(1, 20);
        hdr.writeUInt16LE(ch, 22);
        hdr.writeUInt32LE(sr, 24);
        hdr.writeUInt32LE(sr * ch * (bps / 8), 28);
        hdr.writeUInt16LE(ch * (bps / 8), 32);
        hdr.writeUInt16LE(bps, 34);
        hdr.write("data", 36);
        hdr.writeUInt32LE(pcm.length, 40);
        const wav = Buffer.concat([hdr, pcm]);

        console.log(
          JSON.stringify({
            severity: "INFO",
            message: "step_audio_ready",
            wavSize: wav.length,
            stepCategory,
          })
        );

        await logApiUsage(userId, {
          model: "gemini-2.5-flash-preview-tts",
          type: "stepAudio",
          query: query.substring(0, 50),
        });

        return {
          success: true,
          audio: wav.toString("base64"),
          mimeType: "audio/wav",
          script: stepScript,
        };
      }

      // ── DEEPDIVE MODE: generate expanded sub-sections for a step ──
      if (mode === "deepdive") {
        const { stepContent, stepCategory, stepTitle } = data;
        if (!stepContent) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "stepContent is required for deepdive mode."
          );
        }

        const userLevel = data.userLevel || "intermediate";
        const deepdivePrompt = `You are an expert UE5 instructor creating an in-depth breakdown of a learning step.
The learner is at the ${userLevel.toUpperCase()} level, so tailor depth and vocabulary accordingly.

The learner asked: "${query}"
This is the ${stepCategory || "learning"} step titled "${stepTitle || ""}":

"${stepContent.substring(0, 2000)}"

Create exactly 3 focused sub-sections about the step title: "${stepTitle || ""}". Do NOT introduce concepts from other parts of the source text. Stay anchored to the title topic. Be CONCISE — use bullet points, not paragraphs.

EXAMPLES OF BAD vs GOOD output for the practical section:

Example 1 — Vague vs Specific:
BAD: "1. Add a Force module to simulate explosion force. • Adjust the Force Strength parameter."
GOOD: "1. In the Emitter Update section, right-click > Add Module > Force. • Set Force Strength to 500 as a starting point for a medium-range explosion."
The BAD version is vague. The GOOD version has exact menu paths and values.

Example 2 — Generic vs Title-Specific (CRITICAL):
If the step title is "Replication Ordering Guarantees", a BAD practical section would be: "1. Open your Blueprint. 2. Create a Health variable. 3. Set Replication to Replicated." This is BAD because it teaches basic replication, not ORDERING GUARANTEES specifically.
A GOOD practical section for "Replication Ordering Guarantees" would be: "1. Create two replicated variables: Health and MaxHealth. 2. In the RepNotify function for Health, check if Health > MaxHealth. 3. Note: MaxHealth may not have replicated yet — this demonstrates ordering dependency."
The practical section must teach what is UNIQUE about THIS step title, not just the general topic area.

Return ONLY valid JSON (no markdown, no code fences):
{
  "editorContext": "The specific UE5 editor tool used in this step — one of: Blueprint Editor, Material Editor, Texture Graph, Modeling Mode, Niagara, Sequencer, Level Editor, Animation Blueprint, or Other",
  "sections": [
    {
      "title": "Short title (e.g. 'Core Concept')",
      "content": "2-4 bullet points ONLY (every line starts with •). No introductory sentences. Each bullet is one clear sentence. Total ~80 words. Reference specific UE5 classes or nodes FROM THE SOURCE TEXT ONLY.",
      "type": "concept"
    },
    {
      "title": "Short title (e.g. 'Why It Matters')",
      "content": "2-4 bullet points ONLY (every line starts with •). Cover: how it works, performance implications, common mistakes. Reference concepts from section 1. ~80 words total.",
      "type": "mechanics"
    },
    {
      "title": "Short title (e.g. 'Try It Now')",
      "content": "3-5 numbered steps (1. 2. 3.) the learner can follow in UE5. Each step MUST directly apply a concept from sections 1 and 2 above — do NOT introduce new topics. For any step that needs clarification, add sub-bullets (• prefix) underneath. Be specific about menu paths, node names, AND parameter values. ALWAYS give concrete numbers — e.g. 'set Force Strength to 500' NOT 'adjust Force Strength'. If a reasonable default exists, state it. ~80-100 words total.",
      "type": "practical"
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

        const deepdiveUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const deepdiveResp = await fetch(deepdiveUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: deepdivePrompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 1024,
              responseMimeType: "application/json",
            },
          }),
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
          model: "gemini-2.0-flash",
          type: "deepdive",
          query: query.substring(0, 50),
        });

        return {
          success: true,
          sections,
          editorContext,
        };
      }

      // ── TAKEAWAYS MODE: generate actionable key takeaways ──
      if (mode === "takeaways") {
        const { stepContent, stepCategory, stepAction, stepTitle } = data;

        const takeawayPrompt = `You are a UE5 instructor highlighting KEY TAKEAWAYS for a learner.

The learner asked: "${query}"
This is a ${stepCategory || "learning"} step titled "${stepTitle || ""}":

"${(stepContent || "").substring(0, 1500)}"
${stepAction ? `\nAction steps from this content:\n"${stepAction.substring(0, 500)}"` : ""}

Generate exactly 3 key takeaways the learner MUST know from this step. Each takeaway should be:
- One concise sentence (under 20 words)
- ACTIONABLE: mention a specific UE5 property, Blueprint node, editor menu path, or setting they should check/adjust
- Frame using Blueprint workflows and editor UI, not C++ code syntax
- NOT just restating the problem — tell them WHAT to DO (e.g. "Set NetUpdateFrequency to 100 on your Character Movement Component")
- Include concrete specifics from the content above
- ANTI-HALLUCINATION: ONLY reference UE5 tools, properties, and features that are EXPLICITLY mentioned in the content above. Do NOT invent or assume any UE5 features, volume types, or settings that are not in the provided text.
- BLUEPRINT PRECISION: Blueprints ARE visual programming. NEVER say 'without code' or 'no code needed'. Say 'without writing C++ or text-based code'.

Return ONLY a JSON array of 3 strings.`;

        const takeawayUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const takeawayResp = await fetch(takeawayUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: takeawayPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
          }),
        });

        if (!takeawayResp.ok) {
          const err = await takeawayResp.text();
          throw new Error(`Takeaway generation failed: ${err}`);
        }

        const takeawayJson = await takeawayResp.json();
        const takeawayText = takeawayJson.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Parse JSON array
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
          model: "gemini-2.0-flash",
          type: "takeaways",
          query: query.substring(0, 50),
        });

        return {
          success: true,
          takeaways: takeaways.slice(0, 3),
        };
      }

      // ── QUIZ MODE: generate quiz questions from step content ──
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

        const quizUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const quizResp = await fetch(quizUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: quizPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
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
          model: "gemini-2.0-flash",
          type: "quiz",
          query: query.substring(0, 50),
        });

        return {
          success: true,
          questions: questions.slice(0, count),
        };
      }

      // ── DIAGNOSTIC MODE: generate narrowing questions for adaptive path ──
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

        const diagnosticUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const diagnosticResp = await fetch(diagnosticUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: diagnosticPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
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
          model: "gemini-2.0-flash",
          type: "diagnostic",
          query: query.substring(0, 50),
        });

        return {
          success: diagnosticQuestions.length > 0,
          questions: diagnosticQuestions.slice(0, 5),
          error: diagnosticQuestions.length === 0 ? "No valid questions generated" : null,
        };
      }

      // ── NARRATE MODE: 2-phase narration (Questions + Solution) ──
      if (mode === "narrate") {
        if (!steps || !Array.isArray(steps) || steps.length === 0) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "Must provide steps array for narrate mode."
          );
        }

        // Split steps into two phases
        const questionSteps = steps.filter(
          (s) => s.category === "foundation" || s.category === "diagnosis"
        );
        const solutionSteps = steps.filter(
          (s) => s.category === "fix" || s.category === "transfer"
        );

        // Build summaries for each phase
        const questionOutline = questionSteps
          .map(
            (s, i) => `- "${s.title || `Step ${i + 1}`}": ${(s.summary || "").substring(0, 200)}`
          )
          .join("\n");
        const solutionOutline = solutionSteps
          .map(
            (s, i) => `- "${s.title || `Step ${i + 1}`}": ${(s.summary || "").substring(0, 200)}`
          )
          .join("\n");

        const narratePrompt = `You are a friendly, knowledgeable UE5 instructor recording a guided audio walkthrough for a learner who has a specific problem. Write TWO narration sections separated by "---" on its own line.

The learner asked: "${query}"

SECTION 1 — UNDERSTANDING THE PROBLEM (covers these steps):
${questionOutline || "General UE5 foundation concepts"}

Write 120-150 words that:
- Greet the learner warmly and restate their specific problem
- Explain WHY this problem happens (root cause from the content above)
- Walk through the key concepts they need to understand
- Build confidence: "once you understand this, the fix becomes clear"

---

SECTION 2 — THE SOLUTION (covers these steps):
${solutionOutline || "Practical fix and application steps"}

Write 120-150 words that:
- Transition naturally: "Now that you understand the cause..."
- Walk through the specific fix step by step
- Reference actual UE5 concepts, nodes, or systems from the content
- End with encouragement and a practical next step

Rules:
- Conversational, warm, mentor tone — like explaining to a colleague
- Speak directly using "you"
- Be SPECIFIC to the content — reference actual UE5 concepts
- ALWAYS spell out acronyms on first use (e.g. "Gameplay Ability System, or G.A.S.", "Inverse Kinematics, or I.K.")
- NO markdown, no bullet points, no headers, no formatting
- Just plain spoken text, separated by "---"
- TOTAL must be under 300 words`;

        const narrateScriptUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const narrateScriptResp = await fetch(narrateScriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: narratePrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        });

        if (!narrateScriptResp.ok) {
          const err = await narrateScriptResp.text();
          throw new Error(`Narration script generation failed: ${err}`);
        }

        const narrateScriptJson = await narrateScriptResp.json();
        const fullScript = narrateScriptJson.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (!fullScript || fullScript.length < 50) {
          throw new Error("Generated narration script too short");
        }

        // Split into 2 phases by "---" separator
        const rawPhases = fullScript
          .split(/\n\s*---\s*\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        console.log(
          JSON.stringify({
            severity: "INFO",
            message: "narration_script_generated",
            totalLength: fullScript.length,
            phaseCount: rawPhases.length,
            totalWords: fullScript.split(/\s+/).length,
          })
        );

        // Helper: convert PCM to WAV
        const pcmToWav = (pcmData) => {
          const pcm = Buffer.from(pcmData, "base64");
          const sr = 24000;
          const bps = 16;
          const ch = 1;
          const hdr = Buffer.alloc(44);
          hdr.write("RIFF", 0);
          hdr.writeUInt32LE(36 + pcm.length, 4);
          hdr.write("WAVE", 8);
          hdr.write("fmt ", 12);
          hdr.writeUInt32LE(16, 16);
          hdr.writeUInt16LE(1, 20);
          hdr.writeUInt16LE(ch, 22);
          hdr.writeUInt32LE(sr, 24);
          hdr.writeUInt32LE(sr * ch * (bps / 8), 28);
          hdr.writeUInt16LE(ch * (bps / 8), 32);
          hdr.writeUInt16LE(bps, 34);
          hdr.write("data", 36);
          hdr.writeUInt32LE(pcm.length, 40);
          return Buffer.concat([hdr, pcm]).toString("base64");
        };

        // Helper: generate TTS with one retry
        const generateTts = async (text) => {
          const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
          const ttsBody = {
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Kore" },
                },
              },
            },
          };

          for (let attempt = 0; attempt < 2; attempt++) {
            const resp = await fetch(ttsUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(ttsBody),
            });

            if (resp.ok) {
              const json = await resp.json();
              const part = json.candidates?.[0]?.content?.parts?.[0];
              const ad = part?.inlineData || part?.inline_data;
              if (ad?.data) return pcmToWav(ad.data);
            } else {
              const errText = await resp.text();
              console.log(
                JSON.stringify({
                  severity: "WARNING",
                  message: `tts_attempt_${attempt + 1}_failed`,
                  status: resp.status,
                  error: errText.substring(0, 300),
                })
              );
              // Wait 2s before retry
              if (attempt === 0) await new Promise((r) => setTimeout(r, 2000));
            }
          }
          return null; // Both attempts failed
        };

        // Generate TTS for each phase
        const phases = [];
        const phaseNames = ["questions", "solution"];

        for (let i = 0; i < Math.min(rawPhases.length, 2); i++) {
          const phaseText = rawPhases[i].substring(0, 4000); // Cost cap per phase
          const audioBase64 = await generateTts(phaseText);

          phases.push({
            phase: phaseNames[i] || `phase_${i}`,
            script: phaseText,
            audio: audioBase64,
          });
        }

        console.log(
          JSON.stringify({
            severity: "INFO",
            message: "narration_complete",
            phasesGenerated: phases.length,
            phasesWithAudio: phases.filter((p) => p.audio).length,
          })
        );

        await logApiUsage(userId, {
          model: "gemini-2.5-flash-preview-tts",
          type: "pathNarration",
          query: query.substring(0, 50),
          phaseCount: phases.length,
        });

        return {
          success: true,
          phases,
          totalWords: fullScript.split(/\s+/).length,
        };
      }

      // -- Step 1: Generate a single-narrator briefing script --
      const stepSummaries = steps
        .map(
          (s, i) =>
            `Step ${i + 1} (${s.category || "unknown"}): ${s.summary || s.title || "No summary"}`
        )
        .join("\n");

      const scriptPrompt = `You are writing a short audio briefing script for a UE5 learning path. Single narrator, friendly expert tone.

The learner asked: "${query}"

Here are the learning path steps:
${stepSummaries}

Write a BRIEF (MAXIMUM 150 words, ~45 seconds) narrator monologue that:
- Greets the learner and acknowledges their specific problem
- Briefly explains the root cause
- Previews the key steps they'll learn
- Encourages them that by the end they'll have it solved

Rules:
- Conversational, warm, expert tone — like a mentor
- DO NOT use any markdown or formatting
- Just plain spoken text, no speaker labels
- Keep it concise and engaging`;

      const scriptUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const scriptResp = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: scriptPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      });

      if (!scriptResp.ok) {
        const err = await scriptResp.text();
        throw new Error(`Script generation failed: ${err}`);
      }

      const scriptJson = await scriptResp.json();
      const script = scriptJson.candidates?.[0]?.content?.parts?.[0]?.text || "";

      if (!script || script.length < 50) {
        throw new Error("Generated script too short");
      }

      console.log(
        JSON.stringify({
          severity: "INFO",
          message: "audio_script_generated",
          scriptLength: script.length,
        })
      );

      // -- Step 2: Synthesize single-speaker audio via Gemini TTS --
      const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
      const ttsBody = {
        contents: [{ parts: [{ text: script }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      };

      const ttsResp = await fetch(ttsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ttsBody),
      });

      if (!ttsResp.ok) {
        const err = await ttsResp.text();
        throw new Error(`TTS synthesis failed: ${err}`);
      }

      const ttsJson = await ttsResp.json();
      const firstPart = ttsJson.candidates?.[0]?.content?.parts?.[0];
      const audioData = firstPart?.inlineData || firstPart?.inline_data;

      if (!audioData?.data) {
        console.error(
          JSON.stringify({
            severity: "ERROR",
            message: "tts_no_audio_detail",
            response: JSON.stringify(ttsJson).substring(0, 2000),
          })
        );
        throw new Error("No audio data in TTS response");
      }

      const mimeType = audioData.mimeType || audioData.mime_type || "audio/L16;rate=24000";
      const rawBase64 = audioData.data;

      console.log(
        JSON.stringify({
          severity: "INFO",
          message: "audio_synthesized",
          mimeType,
          dataLength: rawBase64.length,
        })
      );

      // -- Step 3: Convert PCM to WAV and upload to Firebase Storage --
      const pcmBuffer = Buffer.from(rawBase64, "base64");
      const sampleRate = 24000;
      const bitsPerSample = 16;
      const numChannels = 1;
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
      const blockAlign = numChannels * (bitsPerSample / 8);
      const dataSize = pcmBuffer.length;

      // Build WAV header (44 bytes)
      const wavHeader = Buffer.alloc(44);
      wavHeader.write("RIFF", 0);
      wavHeader.writeUInt32LE(36 + dataSize, 4);
      wavHeader.write("WAVE", 8);
      wavHeader.write("fmt ", 12);
      wavHeader.writeUInt32LE(16, 16); // PCM chunk size
      wavHeader.writeUInt16LE(1, 20); // PCM format
      wavHeader.writeUInt16LE(numChannels, 22);
      wavHeader.writeUInt32LE(sampleRate, 24);
      wavHeader.writeUInt32LE(byteRate, 28);
      wavHeader.writeUInt16LE(blockAlign, 32);
      wavHeader.writeUInt16LE(bitsPerSample, 34);
      wavHeader.write("data", 36);
      wavHeader.writeUInt32LE(dataSize, 40);

      const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);

      console.log(
        JSON.stringify({
          severity: "INFO",
          message: "audio_ready",
          wavSize: wavBuffer.length,
        })
      );

      // Return base64 WAV directly (no Storage needed)
      const audioBase64 = wavBuffer.toString("base64");

      await logApiUsage(userId, {
        model: "gemini-2.5-flash-preview-tts",
        type: "audioBriefing",
        query: query.substring(0, 50),
      });

      return {
        success: true,
        audio: audioBase64,
        mimeType: "audio/wav",
        script,
      };
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "audio_briefing_error",
          error: error.message,
        })
      );
      if (error.code) throw error;
      throw new functions.https.HttpsError(
        "internal",
        `Failed to generate audio briefing: ${error.message}`
      );
    }
  });
