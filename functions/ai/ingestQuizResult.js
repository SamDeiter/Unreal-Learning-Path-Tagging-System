/**
 * ingestQuizResult — Record a quiz result against a learner's skillState.
 *
 * Input (callable payload):
 *   {
 *     lessonId: string,                   // required — owner-scoped lesson doc
 *     score: number,                      // required — 0..total
 *     total: number,                      // required — > 0
 *     perQuestionResults?: Array<{        // optional PFA upgrade (Phase 2A)
 *       correct: boolean,
 *       skillTags?: string[]              // falls back to lesson-level skillTags
 *     }>
 *   }
 *
 * Output: { success: true, signalsApplied: number }
 *
 * Two modes:
 *   1. Coarse (back-compat) — when perQuestionResults is absent, collapse the
 *      whole quiz to a single coarse signal per lesson tag using the ratio.
 *   2. Per-question (PFA) — emit one `completed` or `struggled` signal per
 *      question per tag. This drives per-tag successes/failures/opportunities
 *      in the PFA counters so mastery updates at question granularity.
 *
 * Lesson `skillTags` are read from the lesson doc server-side so the client
 * cannot forge tags it doesn't own.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");
const { requireAppCheck } = require("../utils/appCheckMiddleware");
const { applySkillSignals } = require("./skillStateWriter");
const { logMisconceptionSignal } = require("./misconceptionWriter");

const MAX_TAGS = 20;
const MAX_QUESTIONS = 200;

function sanitizeTag(t) {
  return typeof t === "string" && t.length > 0 && t.length <= 120 ? t : null;
}

function sanitizeTagList(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of arr) {
    const t = sanitizeTag(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function ratioToSignal(ratio) {
  if (!Number.isFinite(ratio)) return null;
  if (ratio >= 0.8) return "mastered";
  if (ratio <= 0.4) return "struggled";
  return "encountered";
}

/**
 * Build the list of per-tag signals to apply.
 * Pure — no Firestore dependency. Exported for testing.
 *
 * @param {Object} payload
 * @param {string[]} payload.skillTags  lesson-level fallback tags (required)
 * @param {Array<{correct: boolean, skillTags?: string[]}>} [payload.perQuestionResults]
 * @param {number} [payload.score]
 * @param {number} [payload.total]
 * @returns {Array<{tag: string, signal: string}>}
 */
function buildQuizSignals(payload) {
  const lessonTags = sanitizeTagList(payload && payload.skillTags);
  const perQ = payload && payload.perQuestionResults;

  if (Array.isArray(perQ) && perQ.length > 0) {
    const signals = [];
    const limit = Math.min(perQ.length, MAX_QUESTIONS);
    for (let i = 0; i < limit; i++) {
      const q = perQ[i];
      if (!q || typeof q !== "object") continue;
      const tags = sanitizeTagList(q.skillTags);
      const chosen = tags.length > 0 ? tags : lessonTags;
      if (chosen.length === 0) continue;
      const signal = q.correct ? "completed" : "struggled";
      for (const tag of chosen) {
        signals.push({ tag, signal });
      }
    }
    return signals;
  }

  const score = Number.isFinite(payload && payload.score) ? payload.score : null;
  const total = Number.isFinite(payload && payload.total) && payload.total > 0
    ? payload.total
    : 0;
  if (score === null || total === 0 || lessonTags.length === 0) return [];
  const signal = ratioToSignal(score / total);
  if (!signal) return [];
  return lessonTags.map((tag) => ({ tag, signal }));
}

exports.buildQuizSignals = buildQuizSignals;
exports.ratioToSignal = ratioToSignal;

exports.ingestQuizResult = functions
  .runWith({ memory: "256MB", timeoutSeconds: 10 })
  .https.onCall(async (data, context) => {
    requireAppCheck({ app: context.app, auth: context.auth }, { allowInvalid: false });

    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const uid = context.auth.uid;

    const { lessonId, score, total, perQuestionResults } = data || {};

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
    const skillTags = sanitizeTagList(lessonData.skillTags);

    const signals = buildQuizSignals({
      skillTags,
      perQuestionResults,
      score,
      total,
    });

    const mode = Array.isArray(perQuestionResults) && perQuestionResults.length > 0
      ? "per_question"
      : "coarse";

    if (signals.length === 0) {
      logger.info(JSON.stringify({
        severity: "INFO",
        message: "quiz_ingest_no_signals",
        uid,
        lessonId,
        mode,
        tagCount: skillTags.length,
      }));
      return { success: true, signalsApplied: 0 };
    }

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

    // Misconception capture — log one signal per wrong answer, joining the
    // client-sent pickedIndex against the lesson's stored quiz questions for
    // stem + correct answer + per-choice explanation. All fire-and-forget.
    if (mode === "per_question") {
      const quizQuestions = Array.isArray(lessonData?.quiz?.questions)
        ? lessonData.quiz.questions
        : [];
      const sigPromises = [];
      const limit = Math.min(perQuestionResults.length, MAX_QUESTIONS, quizQuestions.length);
      for (let i = 0; i < limit; i++) {
        const r = perQuestionResults[i];
        if (!r || typeof r !== "object" || r.correct) continue;
        const q = quizQuestions[i];
        if (!q) continue;
        const options = Array.isArray(q.options) ? q.options : [];
        const correctIdx = Number.isFinite(q.correctIndex) ? q.correctIndex : null;
        const pickedIdx = Number.isFinite(r.pickedIndex) ? r.pickedIndex : null;
        const perQTags = sanitizeTagList(r.skillTags);
        const tagsForSignal = perQTags.length > 0 ? perQTags : skillTags;
        if (tagsForSignal.length === 0) continue;
        const pickedOptionText =
          pickedIdx !== null && pickedIdx >= 0 && pickedIdx < options.length
            ? options[pickedIdx]
            : undefined;
        const correctOptionText =
          correctIdx !== null && correctIdx >= 0 && correctIdx < options.length
            ? options[correctIdx]
            : undefined;
        const perChoiceExplanations = Array.isArray(q.explanations) ? q.explanations : null;
        const explanationForPick =
          perChoiceExplanations && pickedIdx !== null
            ? perChoiceExplanations[pickedIdx]
            : undefined;
        sigPromises.push(
          logMisconceptionSignal({
            source: "quiz_wrong",
            uid,
            skillTags: tagsForSignal,
            stem: q.q,
            pickedOptionText,
            correctOptionText,
            explanationForPick,
            lessonId,
            questionIndex: i,
          })
        );
      }
      if (sigPromises.length > 0) {
        Promise.allSettled(sigPromises).catch(() => {});
      }
    }

    logger.info(JSON.stringify({
      severity: "INFO",
      message: "quiz_ingested",
      uid,
      lessonId,
      mode,
      score,
      total,
      signalsApplied: signals.length,
    }));

    return { success: true, signalsApplied: signals.length };
  });
