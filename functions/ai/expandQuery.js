/**
 * expandQuery — Cloud Function to expand a user query into search-optimized variants.
 * Uses Gemini Flash to generate 2-3 alternative phrasings for better retrieval coverage.
 *
 * Example:
 *   Input:  "Lumen reflections flickering"
 *   Output: ["ray traced reflections noise artifacts", "screen space global illumination jitter", "lumen scene lighting flicker"]
 */
const functions = require("firebase-functions");
const { sanitizeAndValidate } = require("../utils/sanitizeInput");
const { normalizeQuery, getCached, setCache } = require("../pipeline/cache");
const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { requireAuth } = require("../utils/authGuard");
const { logApiUsage } = require("../utils/apiUsage");
const { requireAppCheck } = require("../utils/appCheckMiddleware");

exports.expandQuery = functions
  .runWith({
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 15,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    // App Check enforcement (permissive during rollout)
    requireAppCheck({ app: context.app, auth: context.auth }, { allowInvalid: false });
    const userId = requireAuth(context);
    const { query } = data;

    // Rate limit check
    const rateLimitCheck = await checkRateLimit(userId, "generation");
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

    // Security: sanitize input
    const validation = sanitizeAndValidate(query, 300);
    if (validation.blocked) {
      return { success: false, error: validation.reason };
    }

    const normalized = normalizeQuery(validation.clean);

    // Check Firestore-backed cache (survives cold starts, shared across instances)
    const cached = await getCached("query_expansion", { query: normalized });
    if (cached && cached.expansions) {
      return { success: true, expansions: cached.expansions, cached: true };
    }

    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) apiKey = functions.config().gemini?.api_key;
    if (!apiKey) {
      throw new functions.https.HttpsError("internal", "Gemini API key not configured");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const prompt = `You are a search query optimizer for Unreal Engine 5 technical content.

Given this user query: "${validation.clean}"

Generate exactly 3 alternative search queries that would find relevant UE5 content.
Rules:
- Use different technical terminology (synonyms, related concepts)
- Keep each query 3-8 words
- Focus on UE5-specific terms, settings, and subsystems
- Do NOT repeat the original query
- Return ONLY a JSON array of 3 strings, no explanation

Example: ["ray traced reflections noise", "lumen GI artifact flickering", "screen space reflections quality settings"]`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[expandQuery] API error ${response.status}:`, errText.substring(0, 300));
        // Graceful fallback: return empty expansions (search still works with original query)
        return { success: true, expansions: [] };
      }

      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

      let expansions;
      try {
        expansions = JSON.parse(text);
        if (!Array.isArray(expansions)) expansions = [];
        // Sanitize each expansion and limit to 3
        expansions = expansions
          .slice(0, 3)
          .map((q) => String(q).slice(0, 100))
          .filter((q) => q.length > 2);
      } catch {
        console.warn("[expandQuery] Failed to parse Gemini response, using empty expansions");
        expansions = [];
      }

      // Cache result in Firestore (7-day TTL, shared across instances)
      await setCache("query_expansion", { query: normalized }, { expansions });

      return { success: true, expansions };
    } catch (err) {
      console.error("[expandQuery] Error:", err.message);
      // Graceful fallback — never block the main search
      return { success: true, expansions: [] };
    } finally {
      logApiUsage(userId, { type: "generation", function: "expandQuery" , firestoreReads: 2, firestoreWrites: 1 });
    }
  });
