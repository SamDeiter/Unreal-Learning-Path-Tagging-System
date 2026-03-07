const functions = require("firebase-functions");
const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { logApiUsage } = require("../utils/apiUsage");

/**
 * classifySegments — Lightweight Gemini relay for Bespoke Path Stage 2.
 *
 * Accepts a fully-formed prompt from the client and returns the raw
 * Gemini response.  No system prompt wrapping — the client owns the
 * prompt so it can include classification + summary instructions.
 */
exports.classifySegments = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 120, // Bumped for optional grounding call
    memory: "256MB",
  })
  .https.onCall(async (data, context) => {
    const userId = context.auth?.uid || "anonymous";
    const { prompt, grounded } = data;

    if (!prompt || prompt.trim().length < 20) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Prompt must be at least 20 characters."
      );
    }

    const rateLimitCheck = await checkRateLimit(userId, "classifySegments");
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

    try {
      let apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) apiKey = functions.config().gemini?.api_key;
      if (!apiKey) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Server configuration error: API Key missing."
        );
      }

      // ── Call 1: Structured JSON response (existing behavior) ──
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini API ${resp.status}: ${errText}`);
      }

      const json = await resp.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";

      await logApiUsage(userId, {
        model: "gemini-2.0-flash",
        type: "classifySegments",
        promptLength: prompt.length,
        firestoreReads: 3, firestoreWrites: 2,
      });

      // ── Call 2 (optional): Google Search grounding verification ──
      let groundingMetadata = null;
      if (grounded && text) {
        console.log(
          JSON.stringify({
            severity: "INFO",
            message: "grounding_start",
            userId,
            textLength: text.length,
          })
        );

        try {
          // Parse the generated steps to build a verification prompt
          const parsed = JSON.parse(text);
          const steps = parsed.steps || parsed.segments || [];

          console.log(
            JSON.stringify({
              severity: "DEBUG",
              message: "grounding_parsed_steps",
              stepCount: steps.length,
              stepTitles: steps.map((s) => s.title || s.name || s.topic || "(unnamed)"),
            })
          );

          if (steps.length > 0) {
            const summaries = steps
              .map((s) => s.title || s.name || s.topic || "")
              .filter(Boolean)
              .join(", ");

            const verifyPrompt = `Verify these Unreal Engine 5 learning topics and provide accurate information with sources: ${summaries}`;

            console.log(
              JSON.stringify({
                severity: "DEBUG",
                message: "grounding_verify_prompt",
                promptPreview: verifyPrompt.substring(0, 200),
              })
            );

            const groundingBody = {
              contents: [{ parts: [{ text: verifyPrompt }] }],
              tools: [{ google_search: {} }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1024,
              },
            };

            const groundResp = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(groundingBody),
            });

            console.log(
              JSON.stringify({
                severity: "DEBUG",
                message: "grounding_api_response",
                status: groundResp.status,
                ok: groundResp.ok,
              })
            );

            if (groundResp.ok) {
              const groundJson = await groundResp.json();
              const candidate = groundJson.candidates?.[0];

              if (candidate?.groundingMetadata) {
                const gm = candidate.groundingMetadata;
                groundingMetadata = {
                  searchQueries: gm.webSearchQueries || [],
                  sources: (gm.groundingChunks || []).map((c) => ({
                    url: c.web?.uri || "",
                    title: c.web?.title || "",
                  })),
                  supports: (gm.groundingSupports || []).map((s) => ({
                    text: s.segment?.text || "",
                    startIndex: s.segment?.startIndex || 0,
                    endIndex: s.segment?.endIndex || 0,
                    sourceIndices: s.groundingChunkIndices || [],
                  })),
                };

                console.log(
                  JSON.stringify({
                    severity: "INFO",
                    message: "grounding_success",
                    sourceCount: groundingMetadata.sources.length,
                    supportCount: groundingMetadata.supports.length,
                    searchQueries: groundingMetadata.searchQueries,
                    sourceTitles: groundingMetadata.sources.map((s) => s.title),
                  })
                );
              } else {
                console.log(
                  JSON.stringify({
                    severity: "WARNING",
                    message: "grounding_no_metadata",
                    hasCandidate: !!candidate,
                    finishReason: candidate?.finishReason || "unknown",
                  })
                );
              }

              await logApiUsage(userId, {
                model: "gemini-2.0-flash",
                type: "classifySegments_grounding",
                promptLength: verifyPrompt.length,
                firestoreReads: 3, firestoreWrites: 2,
              });
            }
          }
        } catch (groundErr) {
          // Grounding is best-effort — don't fail the main response
          console.error(
            JSON.stringify({
              severity: "ERROR",
              message: "grounding_verification_failed",
              error: groundErr.message,
              stack: groundErr.stack?.substring(0, 300),
            })
          );
        }
      }

      return { success: true, text, groundingMetadata };
    } catch (error) {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "classifySegments_error",
          error: error.message,
        })
      );
      if (error.code) throw error;
      throw new functions.https.HttpsError(
        "internal",
        `Failed to classify segments: ${error.message}`
      );
    }
  });
