/**
 * queryEmbedding.js — one canonical query-embedding helper for the RAG pipeline.
 *
 * Why this exists:
 *   Prior to the audit (2026-04-22), handleProblemFirst.js embedded the query a
 *   second time with `text-embedding-004` purely for the diagnosis cache, while
 *   every other embedding call in the system used `gemini-embedding-001`. That
 *   meant two model endpoints, two vector spaces, and a latent footgun if
 *   anyone reused the cached embedding for cross-collection lookup.
 *
 *   Everything — embedQuery CF, generateSpoke, generateLesson, and all the
 *   Python builders that populate Firestore — indexes with
 *   gemini-embedding-001 / 768d / RETRIEVAL_DOCUMENT. Queries must use the same
 *   model with RETRIEVAL_QUERY for asymmetric pairing.
 */

const MODEL = "gemini-embedding-001";
const DIMENSION = 768;

/**
 * Embed a user query. Returns a 768-dim Float32 array or null on failure.
 * Never throws — callers treat a null return as "cache check / similarity
 * lookup not available" and continue.
 *
 * @param {string} query
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<number[]|null>}
 */
async function embedQueryText(query, apiKey) {
  if (!query || typeof query !== "string" || !apiKey) return null;
  const fetchFn = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${apiKey}`;
  const payload = {
    model: `models/${MODEL}`,
    content: { parts: [{ text: query }] },
    taskType: "RETRIEVAL_QUERY",
    outputDimensionality: DIMENSION,
  };

  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          severity: "WARNING",
          message: "query_embedding_http_failed",
          status: response.status,
        })
      );
      return null;
    }
    const result = await response.json();
    const values = result?.embedding?.values;
    if (!Array.isArray(values) || values.length !== DIMENSION) return null;
    if (values.some((v) => !Number.isFinite(v))) return null;
    return values;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "query_embedding_error",
        error: err.message,
      })
    );
    return null;
  }
}

module.exports = { embedQueryText, MODEL, DIMENSION };
