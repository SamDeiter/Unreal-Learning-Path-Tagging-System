/**
 * LessonPage — Full lesson route for a composed lesson payload.
 *
 * Route format:
 *   #lesson/<lessonId>         → loads from Firestore users/{uid}/lessons/{id}
 *   #lesson/new?query=<text>   → calls generateLesson with the query
 *
 * Reuses QuizEngine, DeepDiveSection, and FeedbackBar. Widget HTML is
 * rendered inside a sandboxed iframe via LessonWidget.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import useLesson from "../../hooks/useLesson";
import QuizEngine from "../BespokePath/QuizEngine";
import DeepDiveSection from "../BespokePath/DeepDiveSection";
import FeedbackBar from "../chat/FeedbackBar";
import LessonWidget from "./LessonWidget";
import SpeakButton from "../Settings/SpeakButton";
import { getFirebaseApp } from "../../services/firebaseConfig";
import { devLog, devWarn } from "../../utils/logger";
import "./LessonPage.css";

const CHOICE_KEYS = ["A", "B", "C", "D", "E", "F"];

/**
 * Convert the lesson quiz shape ({ q, options[], correctIndex, explanation })
 * into the shape QuizEngine consumes ({ stem, choices, correct, explanation }).
 */
function adaptQuizQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => {
    const options = Array.isArray(q.options) ? q.options : [];
    const choices = {};
    options.forEach((opt, i) => {
      const key = CHOICE_KEYS[i] || String(i);
      choices[key] = opt;
    });
    const correctIdx = Number.isInteger(q.correctIndex) ? q.correctIndex : 0;
    const correct = CHOICE_KEYS[correctIdx] || CHOICE_KEYS[0];
    const explanations = Array.isArray(q.explanations)
      ? options.map((_, i) => (typeof q.explanations[i] === "string" ? q.explanations[i] : ""))
      : null;
    return {
      stem: q.q || q.stem || "",
      choices,
      correct,
      explanation: q.explanation || "",
      ...(explanations ? { explanations } : {}),
    };
  });
}

/**
 * Adapt concept.deepDiveSections into the array of { type, title, content }
 * sections DeepDiveSection expects.
 */
function adaptDeepDive(deepDiveSections, notes) {
  const out = [];
  if (notes && typeof notes === "string" && notes.trim()) {
    out.push({ type: "concept", title: "Notes", content: notes.trim() });
  }
  if (Array.isArray(deepDiveSections)) {
    for (const s of deepDiveSections) {
      if (!s) continue;
      out.push({
        type: s.type || "concept",
        title: s.title || "Deep Dive",
        content: s.content || "",
      });
    }
  }
  return out;
}

function parseLessonHash() {
  const hash = window.location.hash.slice(1);
  if (!hash.startsWith("lesson")) return { mode: "invalid" };
  const rest = hash.slice("lesson".length).replace(/^\//, "");
  if (!rest) return { mode: "invalid" };
  const [idPart, queryString = ""] = rest.split("?");
  if (idPart === "new") {
    const params = new URLSearchParams(queryString);
    return { mode: "new", query: params.get("query") || "" };
  }
  return { mode: "load", lessonId: idPart };
}

function LessonSkeleton() {
  return (
    <div className="lesson-page lesson-page--loading" aria-busy="true" aria-live="polite">
      <div className="lesson-skeleton lesson-skeleton--hero" />
      <div className="lesson-skeleton lesson-skeleton--card" />
      <div className="lesson-skeleton lesson-skeleton--widget" />
      <div className="lesson-skeleton lesson-skeleton--card" />
      <div className="lesson-skeleton lesson-skeleton--card" />
      <span className="lesson-visually-hidden">Loading lesson…</span>
    </div>
  );
}

function LessonError({ message, onBack }) {
  return (
    <div className="lesson-page lesson-page--error" role="alert">
      <h2 className="lesson-error__title">We couldn&apos;t load that lesson</h2>
      <p className="lesson-error__body">
        {message || "Something went wrong while preparing your lesson."}
      </p>
      <button type="button" className="lesson-btn lesson-btn--primary" onClick={onBack}>
        Back to chat
      </button>
    </div>
  );
}

export default function LessonPage() {
  const {
    lesson,
    lessonId,
    sessionId,
    loading,
    error,
    generate,
    loadById,
  } = useLesson();

  const [route, setRoute] = useState(() => parseLessonHash());

  useEffect(() => {
    const onHash = () => setRoute(parseLessonHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (route.mode === "load" && route.lessonId) {
      loadById(route.lessonId);
    } else if (route.mode === "new" && route.query) {
      generate({ query: route.query });
    }
  }, [route, loadById, generate]);

  const handleBack = () => {
    window.location.hash = "problem";
  };

  const deepDive = useMemo(
    () => adaptDeepDive(lesson?.concept?.deepDiveSections, lesson?.concept?.notes),
    [lesson]
  );

  const quizQuestions = useMemo(
    () => adaptQuizQuestions(lesson?.quiz?.questions),
    [lesson]
  );

  const [sectionRatings, setSectionRatings] = useState({});
  const rateSection = (idx, rating) =>
    setSectionRatings((prev) => ({ ...prev, [idx]: rating }));

  // Fire-and-forget quiz → skillState write on FULL completion only.
  // Partial completion is intentionally ignored — noisy signal.
  // perQuestionResults enables the PFA (Phase 2A) per-question mode in the
  // ingestQuizResult callable, so mastery updates at question granularity.
  const quizIngestedRef = useRef(null);
  const handleQuizComplete = useCallback(
    ({ score, total, perQuestionResults }) => {
      if (!lessonId) return;
      if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0) return;
      if (quizIngestedRef.current === lessonId) return;
      quizIngestedRef.current = lessonId;
      try {
        const app = getFirebaseApp();
        const functions = getFunctions(app, "us-central1");
        const fn = httpsCallable(functions, "ingestQuizResult");
        const payload = { lessonId, score, total };
        if (Array.isArray(perQuestionResults) && perQuestionResults.length > 0) {
          payload.perQuestionResults = perQuestionResults.map((r) => {
            const out = { correct: !!(r && r.correct) };
            // pickedIndex feeds misconception mining — only forward when the
            // quiz UI actually resolved a selection.
            if (r && Number.isFinite(r.pickedIndex)) out.pickedIndex = r.pickedIndex;
            return out;
          });
        }
        fn(payload)
          .then((res) => {
            devLog(
              `[Quiz] Ingested ${score}/${total} for ${lessonId} (signals=${res?.data?.signalsApplied ?? 0})`
            );
          })
          .catch((err) => {
            devWarn("[Quiz] ingestQuizResult failed:", err?.message || err);
          });
      } catch (err) {
        devWarn("[Quiz] ingestQuizResult setup failed:", err?.message || err);
      }
    },
    [lessonId]
  );

  if (loading) return <LessonSkeleton />;
  if (error) return <LessonError message={error} onBack={handleBack} />;
  if (!lesson) {
    if (route.mode === "invalid") {
      return (
        <LessonError
          message="No lesson was specified. Open a lesson from the Learn Why chat."
          onBack={handleBack}
        />
      );
    }
    return <LessonSkeleton />;
  }

  const { topic, query, diagnosis, objectives, takeaways, widgetHtml } = lesson;

  // ES default-assignment on destructure only fires for undefined, not null.
  // Backend can return any of these as null (refusal paths, sparse answers,
  // partial LLM output) so coerce explicitly — using `|| fallback` handles
  // both undefined and null.
  const safeDiagnosis = diagnosis || {};
  const safeObjectives = objectives || {};
  const safeTakeaways = Array.isArray(takeaways) ? takeaways : [];
  const rootCauses = Array.isArray(safeDiagnosis.root_causes) ? safeDiagnosis.root_causes : [];
  const signals = Array.isArray(safeDiagnosis.signals_to_watch_for)
    ? safeDiagnosis.signals_to_watch_for
    : [];
  const fixSpecific = Array.isArray(safeObjectives.fix_specific)
    ? safeObjectives.fix_specific
    : [];
  const transferable = Array.isArray(safeObjectives.transferable)
    ? safeObjectives.transferable
    : [];

  return (
    <div className="lesson-page">
      <header className="lesson-hero">
        <div className="lesson-hero__eyebrow">Lesson</div>
        <h1 className="lesson-hero__title">{topic || query || "Lesson"}</h1>
        {diagnosis.problem_summary && (
          <p className="lesson-hero__summary">{diagnosis.problem_summary}</p>
        )}
      </header>

      {(fixSpecific.length > 0 || transferable.length > 0) && (
        <section className="lesson-section lesson-objectives">
          <h2 className="lesson-section__title">What you&apos;ll learn</h2>
          <div className="lesson-objectives__grid">
            {fixSpecific.length > 0 && (
              <div className="lesson-objectives__col">
                <h3 className="lesson-objectives__heading">Fix this specifically</h3>
                <ul className="lesson-objectives__list">
                  {fixSpecific.map((o, i) => (
                    <li key={`fs-${i}`}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
            {transferable.length > 0 && (
              <div className="lesson-objectives__col">
                <h3 className="lesson-objectives__heading">Transferable takeaways</h3>
                <ul className="lesson-objectives__list">
                  {transferable.map((o, i) => (
                    <li key={`tr-${i}`}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="lesson-section lesson-widget-section">
        <h2 className="lesson-section__title">Interactive demo</h2>
        <LessonWidget html={widgetHtml} />
      </section>

      {(rootCauses.length > 0 || signals.length > 0) && (
        <section className="lesson-section lesson-diagnosis">
          <h2 className="lesson-section__title">Diagnosis</h2>
          {rootCauses.length > 0 && (
            <div className="lesson-diagnosis__causes">
              {rootCauses.map((cause, i) => {
                const title = typeof cause === "string" ? cause : cause?.title || cause?.name;
                const body =
                  typeof cause === "string"
                    ? null
                    : cause?.description || cause?.detail || cause?.body;
                return (
                  <article key={`rc-${i}`} className="lesson-cause-card">
                    <h3 className="lesson-cause-card__title">{title}</h3>
                    {body && <p className="lesson-cause-card__body">{body}</p>}
                  </article>
                );
              })}
            </div>
          )}
          {signals.length > 0 && (
            <div className="lesson-diagnosis__signals">
              <h3 className="lesson-diagnosis__signals-title">Signals to watch for</h3>
              <ul className="lesson-chip-row">
                {signals.map((s, i) => (
                  <li key={`sig-${i}`} className="lesson-chip">
                    {typeof s === "string" ? s : s?.label || JSON.stringify(s)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {deepDive.length > 0 && (
        <section className="lesson-section lesson-deepdive-section">
          <div className="lesson-section__header">
            <h2 className="lesson-section__title">Deep dive</h2>
            <SpeakButton
              id={`lesson-deepdive-${lessonId || "new"}`}
              text={deepDive.map((s) => `${s.title}. ${s.content}`).join("\n\n")}
            />
          </div>
          <DeepDiveSection
            deepDive={deepDive}
            deepDiveLoading={false}
            sectionRatings={sectionRatings}
            onRateSection={rateSection}
          />
        </section>
      )}

      {safeTakeaways.length > 0 && (
        <section className="lesson-section lesson-takeaways">
          <h2 className="lesson-section__title">Key takeaways</h2>
          <ol className="lesson-takeaways__list">
            {safeTakeaways.map((t, i) => (
              <li key={`tk-${i}`}>{t}</li>
            ))}
          </ol>
        </section>
      )}

      {quizQuestions.length > 0 && (
        <section className="lesson-section lesson-quiz-section">
          <h2 className="lesson-section__title">Check your understanding</h2>
          <QuizEngine
            questions={quizQuestions}
            stepIndex={lessonId || "lesson"}
            onComplete={handleQuizComplete}
          />
        </section>
      )}

      {sessionId && (
        <section className="lesson-section lesson-feedback-section">
          <FeedbackBar sessionId={sessionId} />
        </section>
      )}

      <div className="lesson-footer">
        <button type="button" className="lesson-btn lesson-btn--ghost" onClick={handleBack}>
          ← Back to chat
        </button>
      </div>
    </div>
  );
}
