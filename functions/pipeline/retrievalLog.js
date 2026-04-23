/**
 * retrievalLog.js — single structured log entry per RAG request.
 *
 * Before this existed, per-stage LLM timings were traced but retrieval was
 * opaque: given a bad answer, you could not tell from Cloud Logging whether
 * retrieval returned 0 passages, 10 irrelevant passages, or good passages
 * that the model ignored.
 *
 * Emit exactly one line per query so log-based alerts are simple:
 *   severity=WARNING when retrieved === 0
 *   severity=WARNING when citation_validity_rate < 0.5
 *   severity=INFO otherwise
 */

/**
 * Summarize the passages the handler actually passed into the prompt.
 * Keep fields small — this goes to Cloud Logging on every request.
 */
function summarizePassages(passages) {
  if (!Array.isArray(passages) || passages.length === 0) {
    return { count: 0, sources: {}, similarity: null, ids: [] };
  }
  const sources = {};
  const sims = [];
  const ids = [];
  for (const p of passages) {
    const src = String(p.source || "unknown");
    sources[src] = (sources[src] || 0) + 1;
    if (typeof p.similarity === "number") sims.push(p.similarity);
    // Prefer a stable chunk id; fall back to a composite so we can still
    // correlate with Firestore when id was stripped upstream.
    const id =
      p.id ||
      (p.courseCode && p.videoTitle && p.timestamp
        ? `${p.courseCode}:${p.videoTitle}:${p.timestamp}`.slice(0, 120)
        : p.url
          ? `url:${p.url}`.slice(0, 120)
          : null);
    if (id) ids.push(id);
  }
  const similarity =
    sims.length > 0
      ? {
          min: Math.min(...sims),
          max: Math.max(...sims),
          mean: sims.reduce((a, b) => a + b, 0) / sims.length,
        }
      : null;
  return {
    count: passages.length,
    sources,
    similarity,
    ids: ids.slice(0, 20),
  };
}

/**
 * Emit the single retrieval trace line.
 *
 * @param {Object} args
 * @param {string} args.requestId   - from pipeline/telemetry.createTrace
 * @param {string} args.userId
 * @param {string} args.mode        - e.g. "problem-first"
 * @param {string} args.query       - sanitized user query (already truncated upstream)
 * @param {Array}  args.passages    - passages handed to the LLM
 * @param {Object} [args.citations] - output of validateCitations
 * @param {Object} [args.flags]     - e.g. { sparse_backfill: true, refused: false }
 */
function logRetrieval({ requestId, userId, mode, query, passages, citations, flags }) {
  const summary = summarizePassages(passages);

  let citationStats = null;
  if (citations) {
    const cited = citations.cited || [];
    const valid = citations.valid || [];
    citationStats = {
      cited_count: cited.length,
      valid_count: valid.length,
      invalid_count: (citations.invalid || []).length,
      unused_count: (citations.unusedPassages || []).length,
      validity_rate: cited.length > 0 ? valid.length / cited.length : null,
    };
  }

  const zeroRetrieval = summary.count === 0;
  const lowCitationValidity =
    citationStats && citationStats.validity_rate !== null && citationStats.validity_rate < 0.5;

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      severity: zeroRetrieval || lowCitationValidity ? "WARNING" : "INFO",
      message: "rag_retrieval_trace",
      request_id: requestId,
      user_id: userId,
      mode,
      query: String(query || "").slice(0, 160),
      retrieved: summary,
      citations: citationStats,
      flags: flags || {},
    })
  );
}

module.exports = { logRetrieval, summarizePassages };
