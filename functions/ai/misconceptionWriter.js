/**
 * misconceptionWriter — log raw signals that feed the misconception taxonomy.
 *
 * Called from:
 *   - submitFeedback.js           on `confused` signal
 *   - ingestQuizResult.js         on each wrong answer
 *
 * Signals are stored in the top-level `misconceptionSignals/{id}` collection
 * (global, not per-user) so the mining job can aggregate across learners.
 * Admin-read-only in rules.
 *
 * Writes are fire-and-forget from the caller's perspective — analytics-quality
 * signals, not transactional data. A write failure is logged and swallowed.
 */

const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

const VALID_SOURCES = new Set(["quiz_wrong", "confused_feedback"]);
const MAX_TAGS = 10;
const MAX_STR = 600;

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
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function truncStr(s) {
  if (typeof s !== "string") return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_STR);
}

/**
 * Log a single misconception signal.
 *
 * @param {Object} args
 * @param {"quiz_wrong"|"confused_feedback"} args.source
 * @param {string[]} args.skillTags            required — at least one
 * @param {string} [args.uid]
 * @param {string} [args.stem]                  question stem (quiz_wrong)
 * @param {string} [args.pickedOptionText]      what learner picked
 * @param {string} [args.correctOptionText]     what was correct
 * @param {string} [args.explanationForPick]    per-choice explanation shown
 * @param {string} [args.comment]               free-text comment (confused_feedback)
 * @param {string} [args.sessionId]
 * @param {string} [args.lessonId]
 * @param {number} [args.questionIndex]
 * @returns {Promise<string|null>} signal doc id, or null if rejected / failed
 */
async function logMisconceptionSignal(args = {}) {
  const {
    source,
    uid,
    skillTags,
    stem,
    pickedOptionText,
    correctOptionText,
    explanationForPick,
    comment,
    sessionId,
    lessonId,
    questionIndex,
  } = args;

  if (!VALID_SOURCES.has(source)) return null;
  const tags = sanitizeTags(skillTags);
  if (tags.length === 0) return null;

  const db = admin.firestore();
  const doc = {
    source,
    uid: typeof uid === "string" && uid.length > 0 ? uid : null,
    skillTags: tags,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const setIfPresent = (key, value) => {
    const v = truncStr(value);
    if (v !== null) doc[key] = v;
  };
  setIfPresent("stem", stem);
  setIfPresent("pickedOptionText", pickedOptionText);
  setIfPresent("correctOptionText", correctOptionText);
  setIfPresent("explanationForPick", explanationForPick);
  setIfPresent("comment", comment);
  setIfPresent("sessionId", sessionId);
  setIfPresent("lessonId", lessonId);
  if (Number.isFinite(questionIndex)) doc.questionIndex = questionIndex;

  try {
    const ref = await db.collection("misconceptionSignals").add(doc);
    return ref.id;
  } catch (err) {
    logger.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "misconception_signal_write_failed",
        source,
        error: err && err.message ? err.message : String(err),
      })
    );
    return null;
  }
}

module.exports = {
  logMisconceptionSignal,
  _internal: { sanitizeTags, truncStr, VALID_SOURCES },
};
