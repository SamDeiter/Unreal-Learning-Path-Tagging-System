/**
 * ingestQuizResult — Callable that maps a completed quiz score into skillState.
 *
 * Input:  { lessonId: string, score: number, total: number }
 * Output: { success: true, signalsApplied: number }
 *
 * Decision: we only record signals on FULL quiz completion (client guarantees
 * score/total reflect every question). Partial-completion signals are
 * intentionally dropped — a half-finished quiz is noisy signal.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const { applySkillSignals } = require("./skillStateWriter");

function ratioToSignal(ratio) {
  if (!Number.isFinite(ratio)) return null;
  if (ratio >= 0.8) return "mastered";
  if (ratio <= 0.4) return "struggled";
  return "encountered";
}

exports.ingestQuizResult = functions
  .runWith({ memory: "256MB", timeoutSeconds: 10 })
  .https.onCall(async (data, context) => {
    requireAppCheck({ app: context.app, auth: context.auth }, { allowInvalid: false });

    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const uid = context.auth.uid;

    const { lessonId, score, total } = data || {};

    if (!lessonId || typeof lessonId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "lessonId is required.");
    }
    if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0 || score < 0 || score > total) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid score/total.");
    }

    const db = admin.firestore();
    const lessonRef = db.collection("users").doc(uid).collection("lessons").doc(lessonId);

    let lessonSnap;
    try {
      lessonSnap = await lessonRef.get();
    } catch (err) {
      logger.error(JSON.stringify({
        severity: "ERROR",
        message: "quiz_ingest_lesson_read_failed",
        uid,
        lessonId,
        error: err && err.message ? err.message : String(err),
      }));
      throw new functions.https.HttpsError("internal", "Failed to load lesson.");
    }

    if (!lessonSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Lesson not found.");
    }

    const lessonData = lessonSnap.data() || {};
    const skillTags = Array.isArray(lessonData.skillTags)
      ? lessonData.skillTags.filter((t) => typeof t === "string" && t.length > 0)
      : [];

    const ratio = score / total;
    const signal = ratioToSignal(ratio);

    if (!signal || skillTags.length === 0) {
      logger.info(JSON.stringify({
        severity: "INFO",
        message: "quiz_ingest_no_signals",
        uid,
        lessonId,
        ratio,
        tagCount: skillTags.length,
      }));
      return { success: true, signalsApplied: 0 };
    }

    const signals = skillTags.map((tag) => ({ tag, signal }));

    try {
      await applySkillSignals(uid, signals);
    } catch (err) {
      logger.warn(JSON.stringify({
        severity: "WARNING",
        message: "quiz_ingest_skill_write_failed",
        uid,
        lessonId,
        error: err && err.message ? err.message : String(err),
      }));
    }

    logger.info(JSON.stringify({
      severity: "INFO",
      message: "quiz_ingested",
      uid,
      lessonId,
      score,
      total,
      ratio,
      signal,
      signalsApplied: signals.length,
    }));

    return { success: true, signalsApplied: signals.length };
  });
