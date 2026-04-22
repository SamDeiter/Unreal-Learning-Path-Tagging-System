/**
 * misconceptionReader — read the synthesized misconception taxonomy and
 * build a prompt-friendly snippet for Gemini handlers.
 *
 * Consumed by:
 *   - generateLesson.js        injects into runSpoke + runDiagnosis prompts
 *   - handleProblemFirst.js    injects into the diagnosis prompt
 *
 * Collection: `misconceptions/{id}` (global, see misconceptionWriter for
 * the signal schema and mineMisconceptions for the synthesis pipeline).
 * Document shape (schemaVersion 1):
 *   {
 *     tag: string,                    primary skill tag
 *     relatedTags?: string[],
 *     name: string,                   short handle ("Confuses Action vs Axis Mapping")
 *     description: string,            1-2 sentences of the learner's mental model
 *     symptoms?: string[],            observable wrong-answer patterns
 *     signalCount: number,            raw signals that contributed
 *     learnerCount: number,           distinct learners affected
 *     updatedAt: Timestamp,
 *   }
 *
 * Failure modes are silent — missing collection / read error returns an
 * empty list so the caller's prompt composition continues unaffected.
 */

const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

const DEFAULT_LIMIT = 5;
const MAX_FETCH_TAGS = 10; // Firestore `in` query cap is 10

function sanitizeTags(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const t of arr) {
    if (typeof t !== "string") continue;
    const s = t.slice(0, 120);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_FETCH_TAGS) break;
  }
  return out;
}

function dedupById(docs) {
  const seen = new Set();
  const out = [];
  for (const d of docs) {
    if (!d || !d.id || seen.has(d.id)) continue;
    seen.add(d.id);
    out.push(d);
  }
  return out;
}

function rankMisconceptions(docs) {
  // Primary: signalCount (popularity), secondary: learnerCount (diversity).
  // A misconception hit by 50 signals from 30 learners ranks above one hit
  // 50 times by 2 learners.
  return docs.slice().sort((a, b) => {
    const aSig = Number.isFinite(a.signalCount) ? a.signalCount : 0;
    const bSig = Number.isFinite(b.signalCount) ? b.signalCount : 0;
    if (aSig !== bSig) return bSig - aSig;
    const aL = Number.isFinite(a.learnerCount) ? a.learnerCount : 0;
    const bL = Number.isFinite(b.learnerCount) ? b.learnerCount : 0;
    return bL - aL;
  });
}

/**
 * Read misconceptions for the given tags. Combines hits where the tag
 * matches either `tag` or `relatedTags`.
 *
 * @param {string[]} tags  skill tags to fetch for
 * @param {Object} [options]
 * @param {number} [options.limit=5]
 * @returns {Promise<Array>}  up to `limit` ranked misconception docs
 */
async function readMisconceptionsForTags(tags, options = {}) {
  const clean = sanitizeTags(tags);
  if (clean.length === 0) return [];
  const limit = Number.isFinite(options.limit) && options.limit > 0
    ? Math.min(options.limit, 20)
    : DEFAULT_LIMIT;

  try {
    const db = admin.firestore();
    const col = db.collection("misconceptions");
    const [primarySnap, relatedSnap] = await Promise.all([
      col.where("tag", "in", clean).get().catch(() => null),
      col.where("relatedTags", "array-contains-any", clean).get().catch(() => null),
    ]);
    const docs = [];
    const push = (snap) => {
      if (!snap || snap.empty) return;
      snap.forEach((d) => {
        const data = d.data() || {};
        docs.push({ id: d.id, ...data });
      });
    };
    push(primarySnap);
    push(relatedSnap);
    const unique = dedupById(docs);
    const ranked = rankMisconceptions(unique);
    return ranked.slice(0, limit);
  } catch (err) {
    logger.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "misconception_read_error",
        error: err && err.message ? err.message : String(err),
      })
    );
    return [];
  }
}

/**
 * Build a compact prompt block listing known misconceptions for the
 * requested tags. Returns "" when the list is empty so callers can
 * conditionally concatenate without null checks.
 *
 * @param {Array} misconceptions
 * @returns {string}
 */
function buildMisconceptionSnippet(misconceptions) {
  if (!Array.isArray(misconceptions) || misconceptions.length === 0) return "";
  const lines = ["Known misconceptions for this topic (from prior learners — preempt these):"];
  for (const m of misconceptions) {
    if (!m || typeof m !== "object") continue;
    const name = typeof m.name === "string" ? m.name.trim() : "";
    const description = typeof m.description === "string" ? m.description.trim() : "";
    if (!name && !description) continue;
    const head = name || "(unnamed)";
    lines.push(description ? `- ${head}: ${description}` : `- ${head}`);
  }
  if (lines.length === 1) return "";
  return lines.join("\n");
}

module.exports = {
  readMisconceptionsForTags,
  buildMisconceptionSnippet,
  _internal: { sanitizeTags, rankMisconceptions, dedupById },
};
