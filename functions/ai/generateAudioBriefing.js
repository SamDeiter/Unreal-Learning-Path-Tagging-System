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
    if (mode === "step" || mode === "takeaways" || mode === "quiz") {
      if (!query || !data.stepContent) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Must provide query and stepContent for ${mode} mode.`
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

        // Generate a short single-speaker explanation (50 words max)
        const stepPrompt = `You are a friendly UE5 instructor giving a concise audio tip.

The learner asked: "${query}"
This is the ${stepCategory || "learning"} step titled "${stepTitle || ""}":

"${stepContent.substring(0, 500)}"

In exactly 2-3 sentences (under 50 words), explain the KEY THING the learner should focus on in this step. Be specific to the actual content, not generic. Speak directly to the learner using "you".

Do NOT use any markdown, bullet points, or formatting. Just plain conversational text.`;

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
                prebuiltVoiceConfig: { voiceName: "Kore" },
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

      // ── TAKEAWAYS MODE: generate actionable key takeaways ──
      if (mode === "takeaways") {
        const { stepContent, stepCategory, stepAction } = data;

        const takeawayPrompt = `You are a UE5 instructor highlighting KEY TAKEAWAYS for a learner.

The learner asked: "${query}"
This is a ${stepCategory || "learning"} step:

"${(stepContent || "").substring(0, 1500)}"
${stepAction ? `\nAction steps from this content:\n"${stepAction.substring(0, 500)}"` : ""}

Generate exactly 3 key takeaways the learner MUST know from this step. Each takeaway should be:
- One concise sentence (under 20 words)
- ACTIONABLE: mention a specific UE5 property, file, Blueprint node, menu path, or setting they should check/adjust
- NOT just restating the problem — tell them WHAT to DO (e.g. "Set NetUpdateFrequency to 100 on your Character Movement Component")
- Include concrete specifics from the content above

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
            takeaways = JSON.parse(match[0]);
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
- Reference specific properties, classes, nodes, or settings from the content
- Have exactly 4 choices (A, B, C, D) — only ONE correct
- Include a 1-sentence explanation for the correct answer

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
            const parsed = JSON.parse(match[0]);
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
