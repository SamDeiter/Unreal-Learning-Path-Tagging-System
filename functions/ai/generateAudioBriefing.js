const functions = require("firebase-functions");
const admin = require("firebase-admin");
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
    if (mode === "step") {
      if (!query || !data.stepContent) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Must provide query and stepContent for step mode."
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
