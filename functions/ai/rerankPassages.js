/**
 * rerankPassages — Cloud Function to re-rank retrieved passages using Gemini as a cross-encoder.
 *
 * Takes a query + array of passages, asks Gemini to score each passage's relevance 0-10,
 * and returns them sorted by that score. This is much more accurate than cosine similarity
 * alone because the model reads query and passage together.
 */
const functions = require("firebase-functions");
const { sanitizeAndValidate } = require("../utils/sanitizeInput");

exports.rerankPassages = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 20,
    memory: "256MB",
  })
  .https.onCall(async (data) => {
    const { query, passages } = data;

    // Validate
    const validation = sanitizeAndValidate(query, 300);
    if (validation.blocked) {
      return { success: false, error: validation.reason };
    }

    if (!Array.isArray(passages) || passages.length === 0) {
      return { success: true, reranked: [] };
    }

    // Cap at 20 passages to keep prompt reasonable
    const truncated = passages.slice(0, 20);

    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) apiKey = functions.config().gemini?.api_key;
    if (!apiKey) {
      throw new functions.https.HttpsError("internal", "Gemini API key not configured");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // Build numbered passage list
    const passageList = truncated
      .map((p, i) => `[${i}] ${String(p.text || "").slice(0, 300)}`)
      .join("\n");

    const prompt = `You are a relevance scoring engine for Unreal Engine 5 technical content.

Query: "${validation.clean}"

Score each passage 0-10 for how relevant it is to answering this UE5 query.
- 10 = directly answers the question or describes the exact solution
- 7-9 = highly relevant context about the right subsystem/feature
- 4-6 = somewhat related but not directly useful
- 0-3 = irrelevant or wrong context

Passages:
${passageList}

Return ONLY a JSON array of objects: [{"index": 0, "score": 8}, {"index": 1, "score": 3}, ...]
Include ALL ${truncated.length} passages.`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 400,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[rerankPassages] API error ${response.status}:`, errText.substring(0, 300));
        // Graceful fallback: return passages in original order
        return { success: true, reranked: truncated, fallback: true };
      }

      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

      let scores;
      try {
        scores = JSON.parse(text);
        if (!Array.isArray(scores)) scores = [];
      } catch {
        console.warn("[rerankPassages] Failed to parse scores, returning original order");
        return { success: true, reranked: truncated, fallback: true };
      }

      // Build score map
      const scoreMap = new Map();
      for (const s of scores) {
        if (typeof s.index === "number" && typeof s.score === "number") {
          scoreMap.set(s.index, Math.max(0, Math.min(10, s.score)));
        }
      }

      // Attach scores and sort
      const reranked = truncated.map((p, i) => ({
        ...p,
        _rerankScore: scoreMap.get(i) ?? 5, // default 5 if missing
      }));
      reranked.sort((a, b) => b._rerankScore - a._rerankScore);

      return { success: true, reranked };
    } catch (err) {
      console.error("[rerankPassages] Error:", err.message);
      return { success: true, reranked: truncated, fallback: true };
    }
  });
