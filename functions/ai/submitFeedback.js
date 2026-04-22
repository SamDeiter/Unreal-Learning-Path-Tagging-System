/**
 * submitFeedback — Callable that records user feedback on a tutor session
 * and, when appropriate, updates skillState.
 *
 * Input:  { sessionId, signal, tagsTouched?, comment? }
 * Output: { success: true, feedbackId }
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const { applySkillSignals } = require("./skillStateWriter");
const { logMisconceptionSignal } = require("./misconceptionWriter");

const VALID_SIGNALS = new Set([
  "helpful",
  "not_helpful",
  "already_knew",
  "confused",
  "completed",
  "rejected",
]);

const SIGNAL_TO_SKILL = {
  already_knew: "mastered",
  completed: "completed",
  confused: "struggled",
  not_helpful: "rejected",
  rejected: "rejected",
  helpful: null,
};

function sanitizeTags(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const t of arr) {
    if (typeof t === "string" && t.length > 0 && t.length <= 120) out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

exports.submitFeedback = functions
  .runWith({ memory: "256MB", timeoutSeconds: 10 })
  .https.onCall(async (data, context) => {
    requireAppCheck({ app: context.app, auth: context.auth }, { allowInvalid: false });

    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const uid = context.auth.uid;

    const { sessionId, signal, tagsTouched, comment } = data || {};

    if (!sessionId || typeof sessionId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "sessionId is required.");
    }
    if (!signal || !VALID_SIGNALS.has(signal)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid signal.");
    }
    const tags = sanitizeTags(tagsTouched);
    const trimmedComment = typeof comment === "string" ? comment.slice(0, 2000) : null;

    const db = admin.firestore();
    const feedbackRef = db
      .collection("users")
      .doc(uid)
      .collection("feedback")
      .doc();

    const doc = {
      uid,
      sessionId,
      signal,
      tagsTouched: tags,
      comment: trimmedComment,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await feedbackRef.set(doc);
    } catch (err) {
      logger.error(JSON.stringify({
        severity: "ERROR",
        message: "feedback_write_failed",
        uid,
        sessionId,
        error: err && err.message ? err.message : String(err),
      }));
      throw new functions.https.HttpsError("internal", "Failed to record feedback.");
    }

    const mapped = SIGNAL_TO_SKILL[signal];
    if (mapped && tags.length > 0) {
      const signalsPayload = tags.map((tag) => ({ tag, signal: mapped }));
      applySkillSignals(uid, signalsPayload).catch(() => {});
    }

    // Misconception capture — `confused` on a tagged message is a direct
    // signal the learner hit a misconception on those tags.
    if (signal === "confused" && tags.length > 0) {
      logMisconceptionSignal({
        source: "confused_feedback",
        uid,
        skillTags: tags,
        comment: trimmedComment,
        sessionId,
      }).catch(() => {});
    }

    logger.info(JSON.stringify({
      severity: "INFO",
      message: "feedback_submitted",
      uid,
      sessionId,
      signal,
      tagCount: tags.length,
    }));

    return { success: true, feedbackId: feedbackRef.id };
  });
