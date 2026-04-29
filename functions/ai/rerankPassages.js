/**
 * rerankPassages — Cloud Function to re-rank retrieved passages using Vertex AI's
 * managed Discovery Engine semantic ranker.
 *
 * Migrated 2026-04-29 from a Gemini-as-cross-encoder approach (Gemini 2.5 Flash
 * scoring each passage 0–10) to the managed `semantic-ranker-default@latest`
 * model. The 65-case golden eval showed:
 *   - gemini reranker: 0 measurable lift over cosine baseline, ~4s latency
 *   - managed reranker: +4.6pp hit@10, +7.8pp mrr@10, ~125ms latency
 *
 * Input/output contract is unchanged so callers don't need to update.
 */

const functions = require("firebase-functions");
const { sanitizeAndValidate } = require("../utils/sanitizeInput");
const { checkRateLimit, checkGlobalRateLimit } = require("../utils/rateLimit");
const { requireAuth } = require("../utils/authGuard");
const { logApiUsage } = require("../utils/apiUsage");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const { getAccessToken, PROJECT_ID } = require("../utils/vertex");

// Discovery Engine ranker is a global endpoint (not per-region like aiplatform).
const RANKER_URL = `https://discoveryengine.googleapis.com/v1/projects/${PROJECT_ID}/locations/global/rankingConfigs/default_ranking_config:rank`;
const RANKER_MODEL = "semantic-ranker-default@latest";
// Cap at 30 — same as the previous Gemini implementation, plus the ranker
// charges per record so unbounded input would balloon cost.
const MAX_RECORDS = 30;
// Each record's content is capped at 1024 tokens (~4000 chars) by the model.
const MAX_CONTENT_CHARS = 4000;

exports.rerankPassages = functions
  .runWith({
    timeoutSeconds: 20,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    requireAppCheck({ app: context.app, auth: context.auth }, { allowInvalid: false });
    const userId = requireAuth(context);
    const { query, passages } = data;

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

    const validation = sanitizeAndValidate(query, 300);
    if (validation.blocked) {
      return { success: false, error: validation.reason };
    }

    if (!Array.isArray(passages) || passages.length === 0) {
      return { success: true, reranked: [] };
    }

    const truncated = passages.slice(0, MAX_RECORDS);
    // Build records the ranker expects. Use index as id so we can map back.
    const records = truncated.map((p, i) => ({
      id: String(i),
      title: String(p.title || p.video_title || "").slice(0, 300),
      content: String(p.text || "").slice(0, MAX_CONTENT_CHARS),
    }));

    const body = {
      model: RANKER_MODEL,
      query: validation.clean,
      topN: truncated.length, // return all, sorted — caller decides downstream cut
      records,
    };

    try {
      const token = await getAccessToken();
      const fetchFn =
        typeof fetch === "function"
          ? fetch
          : (...args) => import("node-fetch").then(({ default: f }) => f(...args));

      const resp = await fetchFn(RANKER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Goog-User-Project": PROJECT_ID,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(
          JSON.stringify({
            severity: "WARNING",
            message: "rerankPassages.discovery_engine_error",
            status: resp.status,
            body: errText.substring(0, 300),
          })
        );
        return { success: true, reranked: truncated, fallback: true };
      }

      const result = await resp.json();
      const ranked = Array.isArray(result?.records) ? result.records : [];

      // Map ranker output back to original passage objects in the new order.
      // Score 0–1 from Discovery Engine — multiply by 10 to keep _rerankScore
      // on the same 0–10 scale callers may have come to expect.
      const reranked = [];
      for (const r of ranked) {
        const idx = Number(r.id);
        if (Number.isInteger(idx) && idx >= 0 && idx < truncated.length) {
          reranked.push({
            ...truncated[idx],
            _rerankScore: typeof r.score === "number" ? r.score * 10 : 5,
          });
        }
      }

      // Defensive: if the ranker dropped any records, append remaining ones at
      // the bottom with default score so we never lose passages on the way through.
      if (reranked.length < truncated.length) {
        const seen = new Set(reranked.map((p, i) => p._rerankIdx ?? i));
        truncated.forEach((p, i) => {
          if (!seen.has(i)) reranked.push({ ...p, _rerankScore: 0 });
        });
      }

      return { success: true, reranked };
    } catch (err) {
      console.error(
        JSON.stringify({
          severity: "ERROR",
          message: "rerankPassages.error",
          error: err.message,
        })
      );
      return { success: false, reranked: truncated, fallback: true, error: err.message };
    } finally {
      logApiUsage(userId, {
        type: "generation",
        function: "rerankPassages",
        model: RANKER_MODEL,
        firestoreReads: 12,
        firestoreWrites: 1,
      });
    }
  });
