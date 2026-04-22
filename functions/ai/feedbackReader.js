/**
 * feedbackReader.js — Read most-recent learner feedback and build a
 * prompt-friendly "affective directive" that steers the next tutor turn.
 *
 * Phase 3 — Affective-Feedback Loop.
 *
 * Schema: users/{uid}/feedback/{fid}
 *   { uid, sessionId, signal, tagsTouched, comment, createdAt }
 *
 * The feedback collection is populated by functions/ai/submitFeedback.js.
 * Those writes update skillState but never flowed back into the next AI
 * turn. This reader closes that loop — the handler asks for the most recent
 * signal, translates it to a directive, and threads the directive into its
 * prompt composition.
 *
 * All reads are defensive — a missing doc / read error returns null.
 * Never throws.
 *
 * Freshness: signals older than PRIOR_FEEDBACK_WINDOW_MS are ignored. Stale
 * feedback from yesterday's completely different topic should not steer a
 * fresh question today.
 */

const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

// 24h freshness window. Stale feedback → ignored.
const PRIOR_FEEDBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

function toMillis(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof v.toMillis === "function") {
    try { return v.toMillis(); } catch (_) { return 0; }
  }
  if (v.seconds) return v.seconds * 1000;
  return 0;
}

/**
 * Read the most-recent feedback doc(s) for a user, filtered optionally by
 * sessionId, ordered by createdAt DESC.
 *
 * @param {string} uid
 * @param {{ sessionId?: string, limit?: number }} [opts]
 * @returns {Promise<object|null|object[]>}
 *   - limit=1 (default): single doc or null
 *   - limit>1: array (possibly empty)
 *   Stale entries (older than PRIOR_FEEDBACK_WINDOW_MS) are filtered out.
 */
async function readLatestFeedback(uid, opts = {}) {
  const { sessionId, limit = 1 } = opts || {};
  if (!uid || typeof uid !== "string") return limit > 1 ? [] : null;
  try {
    const db = admin.firestore();
    let q = db
      .collection("users")
      .doc(uid)
      .collection("feedback")
      .orderBy("createdAt", "desc");
    if (sessionId && typeof sessionId === "string") {
      q = q.where("sessionId", "==", sessionId);
    }
    // Fetch a small buffer — stale entries may get filtered below so we ask
    // for up to 2x the requested limit (capped at 10) to survive some churn
    // without pulling the whole collection.
    const fetchLimit = Math.max(limit, Math.min(limit * 2, 10));
    q = q.limit(fetchLimit);

    const snap = await q.get();
    const now = Date.now();
    const out = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const createdMs = toMillis(d.createdAt);
      if (createdMs > 0 && now - createdMs > PRIOR_FEEDBACK_WINDOW_MS) return;
      out.push({ id: doc.id, ...d });
    });
    if (limit > 1) return out.slice(0, limit);
    return out.length > 0 ? out[0] : null;
  } catch (err) {
    logger.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "feedback_read_error",
        uid,
        sessionId: sessionId || null,
        error: err && err.message ? err.message : String(err),
      })
    );
    return limit > 1 ? [] : null;
  }
}

/**
 * Build an affective directive string from a feedback doc.
 *
 * Mapping:
 *   confused      → break down, simplify, surface prereqs
 *   already_knew  → compress, raise altitude
 *   not_helpful   → try a fundamentally different angle
 *   rejected      → same as not_helpful
 *   helpful       → "" (don't overfit on positives)
 *   completed     → "" (don't overfit on positives)
 *   (unknown)     → ""
 *
 * Pure. Null/undefined → "".
 *
 * @param {object|null|undefined} feedbackDoc
 * @returns {string}
 */
function buildAffectiveDirective(feedbackDoc) {
  if (!feedbackDoc || typeof feedbackDoc !== "object") return "";
  const signal = typeof feedbackDoc.signal === "string" ? feedbackDoc.signal : "";
  switch (signal) {
    case "confused":
      return "The learner marked the previous response as CONFUSING. For this response: use simpler language, add concrete examples, break concepts into smaller steps, and surface any prerequisite knowledge explicitly.";
    case "already_knew":
      return "The learner marked the previous response as ALREADY KNOWN. For this response: compress foundational explanation, skip basics, raise the altitude toward advanced nuance or edge cases.";
    case "not_helpful":
    case "rejected":
      return "The learner marked the previous response as NOT HELPFUL. For this response: try a fundamentally different angle — a different analogy, a different level of abstraction, or a worked example instead of explanation.";
    case "helpful":
    case "completed":
      return "";
    default:
      return "";
  }
}

module.exports = {
  readLatestFeedback,
  buildAffectiveDirective,
  PRIOR_FEEDBACK_WINDOW_MS,
};
