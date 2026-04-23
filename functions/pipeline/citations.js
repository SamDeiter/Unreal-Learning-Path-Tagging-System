/**
 * citations.js — Parse and validate [n] citations emitted by the answer_data
 * stage of handleProblemFirst.
 *
 * The model is instructed to cite retrieved passages with bracketed integers
 * like "In Project Settings → Engine → Input [1] …". Before this module existed
 * nothing checked whether those integers referred to real passages.
 *
 * A citation is valid when 1 <= n <= passages.length. Anything else is logged
 * and surfaced so the UI can warn the learner ("citation points to a passage
 * we didn't retrieve — please verify").
 */

const CITATION_RE = /\[(\d{1,2})\]/g;

/**
 * Collect all [n] references from any string fields on the answer payload.
 * @param {Object} answer - the raw answer_data shape
 * @returns {number[]} ordered, de-duplicated citation indices (1-based, as
 *                     they appear in the prose)
 */
function extractCitations(answer) {
  if (!answer || typeof answer !== "object") return [];
  const refs = new Set();
  const walk = (v) => {
    if (v === null || v === undefined) return;
    if (typeof v === "string") {
      for (const m of v.matchAll(CITATION_RE)) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n >= 1 && n <= 50) refs.add(n);
      }
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (typeof v === "object") {
      Object.values(v).forEach(walk);
    }
  };
  walk(answer);
  return Array.from(refs).sort((a, b) => a - b);
}

/**
 * Validate citations against the passage list and classify them.
 *
 * @param {Object} answer
 * @param {Array} passages - the passages the model saw, in the same 1-based
 *                           order used to build the evidence block
 * @returns {{
 *   cited: number[],         // all [n] referenced
 *   valid: number[],         // in [1, passages.length]
 *   invalid: number[],       // out-of-range references
 *   unusedPassages: number[] // indices passed to model but never cited
 * }}
 */
function validateCitations(answer, passages) {
  const n = Array.isArray(passages) ? passages.length : 0;
  const cited = extractCitations(answer);
  const valid = cited.filter((r) => r >= 1 && r <= n);
  const invalid = cited.filter((r) => r < 1 || r > n);
  const usedSet = new Set(valid);
  const unusedPassages = [];
  for (let i = 1; i <= n; i++) {
    if (!usedSet.has(i)) unusedPassages.push(i);
  }
  return { cited, valid, invalid, unusedPassages };
}

module.exports = { extractCitations, validateCitations, CITATION_RE };
