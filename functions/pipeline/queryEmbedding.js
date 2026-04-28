/**
 * queryEmbedding.js — one canonical query-embedding helper for the RAG pipeline.
 *
 * Backed by Vertex AI (gemini-embedding-001 / 768d / RETRIEVAL_QUERY) so it
 * matches the doc-side embedding model used to populate Firestore. ADC auth.
 *
 * The `apiKey` parameter is retained for call-site compatibility but ignored.
 */

const vertex = require("../utils/vertex");

const MODEL = "gemini-embedding-001";
const DIMENSION = 768;

/**
 * Embed a user query. Returns a 768-dim Float32 array or null on failure.
 * Never throws — callers treat a null return as "cache check / similarity
 * lookup not available" and continue.
 *
 * @param {string} query
 * @param {string} [_apiKey] - Ignored; ADC is used. Kept for call-site stability.
 * @returns {Promise<number[]|null>}
 */
async function embedQueryText(query, _apiKey) {
  if (!query || typeof query !== "string") return null;

  const payload = {
    content: { parts: [{ text: query }] },
    taskType: "RETRIEVAL_QUERY",
    outputDimensionality: DIMENSION,
  };

  try {
    const response = await vertex.embedContent(MODEL, payload);
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
