const functions = require("firebase-functions");
const { checkRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");

/**
 * generateAudioBriefing — NotebookLM-style audio overview for a learning path.
 *
 * Pipeline:
 * 1. Accept learning path data (steps, summaries, user query)
 * 2. Generate a 2-speaker dialog script via Gemini Flash
 * 3. Synthesize audio via Gemini 2.5 Flash Preview TTS (multi-speaker)
 * 4. Return base64 WAV audio directly (avoids Firebase Storage dependency)
 */
exports.generateAudioBriefing = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";
    const { query, steps } = data;

    if (!query || !steps || !Array.isArray(steps) || steps.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Must provide query and steps array."
      );
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

      // ── Step 1: Generate a 2-speaker dialog script ────────────────────
      const stepSummaries = steps
        .map(
          (s, i) =>
            `Step ${i + 1} (${s.category || "unknown"}): ${s.summary || s.title || "No summary"}`
        )
        .join("\n");

      const scriptPrompt = `You are writing a short, 2-person audio briefing script for a UE5 learning path.

The learner asked: "${query}"

Here are the learning path steps:
${stepSummaries}

Write a conversational dialog between two speakers:
- "Instructor": A friendly UE5 expert who explains the root cause and the fix
- "Learner": A curious developer who asks clarifying questions

Rules:
- Keep it under 800 words total (about 2-3 minutes of audio)
- Instructor should explain WHY the problem happens (root cause) and HOW to fix it
- Learner should ask 2-3 natural follow-up questions
- Use conversational language, not lecture-style
- DO NOT use any markdown or formatting
- Format EXACTLY as:
Instructor: [text]
Learner: [text]
Instructor: [text]
...

Start with Instructor greeting the learner and mentioning their specific problem.`;

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

      // ── Step 2: Synthesize multi-speaker audio via Gemini TTS ─────────
      const ttsPrompt = `TTS the following conversation between Instructor and Learner:\n\n${script}`;

      const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
      const ttsBody = {
        contents: [{ parts: [{ text: ttsPrompt }] }],
        generationConfig: {
          response_modalities: ["AUDIO"],
          speech_config: {
            multi_speaker_voice_config: {
              speaker_voice_configs: [
                {
                  speaker: "Instructor",
                  voice_config: {
                    prebuilt_voice_config: { voice_name: "Kore" },
                  },
                },
                {
                  speaker: "Learner",
                  voice_config: {
                    prebuilt_voice_config: { voice_name: "Puck" },
                  },
                },
              ],
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
      const audioData = ttsJson.candidates?.[0]?.content?.parts?.[0]?.inline_data;

      if (!audioData?.data) {
        throw new Error("No audio data in TTS response");
      }

      console.log(
        JSON.stringify({
          severity: "INFO",
          message: "audio_synthesized",
          mimeType: audioData.mime_type,
          dataLength: audioData.data.length,
        })
      );

      await logApiUsage(userId, {
        model: "gemini-2.5-flash-preview-tts",
        type: "audioBriefing",
        query: query.substring(0, 50),
      });

      return {
        success: true,
        audio: audioData.data, // base64 encoded audio
        mimeType: audioData.mime_type || "audio/L16;rate=24000",
        script, // Return script for optional display
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
