/**
 * WebPlayerPreview — In-app preview of a web-playable learning path.
 *
 * Renders a full-screen overlay with sidebar navigation and step content.
 * Organized into 3 sections: Intro → Lessons (grouped) → Quiz.
 * Tracks progress via localStorage for resume capability.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import {
  prepareStepData,
  getProgress,
  markStepComplete,
  generatePathId,
  formatTime,
  getCategoryClass,
} from "../../services/webPlayerService";
import { generateQuizForPath } from "../../services/quizService";
import LearnerView from "../LearnerView/LearnerView";
import "./WebPlayerPreview.css";

// ── Section Classification ─────────────────────────────────────────

const SECTION_CONFIG = [
  {
    id: "prerequisites",
    label: "📘 Prerequisites",
    match: (step) => {
      const cat = (step.category || "").toLowerCase();
      const phase = (step.phase || "").toLowerCase();
      const tier = (step.tier || "").toLowerCase();
      return (
        cat.includes("foundation") || cat.includes("prerequisite") || cat.includes("diagnosis") ||
        phase === "prerequisite" ||
        tier === "beginner"
      );
    },
  },
  {
    id: "core",
    label: "📗 Core Lessons",
    match: (step) => {
      const cat = (step.category || "").toLowerCase();
      const phase = (step.phase || "").toLowerCase();
      const tier = (step.tier || "").toLowerCase();
      return (
        cat.includes("core") || cat.includes("fix") ||
        phase === "core" ||
        tier === "intermediate"
      );
    },
  },
  {
    id: "practice",
    label: "📙 Practice & Reference",
    match: (step) => {
      const cat = (step.category || "").toLowerCase();
      const phase = (step.phase || "").toLowerCase();
      const tier = (step.tier || "").toLowerCase();
      return (
        cat.includes("practice") || cat.includes("transfer") ||
        phase === "supplemental" ||
        tier === "advanced"
      );
    },
  },
];

/** Group steps into sections by category/phase/tier. */
function groupStepsBySection(steps) {
  const groups = SECTION_CONFIG.map((cfg) => ({
    ...cfg,
    steps: [],
  }));

  steps.forEach((step, idx) => {
    const placed = groups.find((g) => g.match(step));
    // fallback to core
    const target = placed || groups[1];
    target.steps.push({ ...step, globalIndex: idx });
  });

  // Only return non-empty sections
  return groups.filter((g) => g.steps.length > 0);
}

// ── Quiz Question Component ────────────────────────────────────────

function QuizCard({ question, index, selectedAnswer, onSelect }) {
  const choices = question.choices || {};
  const choiceEntries = Object.entries(choices).slice(0, 4);

  return (
    <div className="wp-quiz-card">
      <p className="wp-quiz-stem">
        <strong>Q{index + 1}:</strong> {question.stem}
      </p>
      <div className="wp-quiz-choices">
        {choiceEntries.map(([key, text]) => (
          <label
            key={key}
            className={`wp-quiz-choice ${selectedAnswer === key ? "wp-quiz-selected" : ""} ${
              selectedAnswer && key === question.correct ? "wp-quiz-correct" : ""
            } ${
              selectedAnswer && selectedAnswer === key && key !== question.correct
                ? "wp-quiz-wrong"
                : ""
            }`}
          >
            <input
              type="radio"
              name={`quiz-q-${index}`}
              value={key}
              checked={selectedAnswer === key}
              onChange={() => onSelect(key)}
              disabled={!!selectedAnswer}
            />
            <span className="wp-quiz-letter">{key}</span>
            <span className="wp-quiz-text">{text}</span>
          </label>
        ))}
      </div>
      {selectedAnswer && (
        <div
          className={`wp-quiz-feedback ${
            selectedAnswer === question.correct ? "wp-quiz-fb-correct" : "wp-quiz-fb-wrong"
          }`}
        >
          {selectedAnswer === question.correct ? "✅ Correct!" : `❌ Incorrect — the answer is ${question.correct}.`}
          {question.explanation && <p className="wp-quiz-explanation">{question.explanation}</p>}
        </div>
      )}
    </div>
  );
}

QuizCard.propTypes = {
  question: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  selectedAnswer: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

// ── Main Component ─────────────────────────────────────────────────

export default function WebPlayerPreview({
  pathResult,
  courses,
  onClose,
}) {
  const pathTitle = pathResult?.query
    ? `UE5 Learning Path: ${pathResult.query.substring(0, 60)}`
    : "Learning Path";

  // Stable path ID for progress tracking
  const pathId = useMemo(
    () => generatePathId(pathTitle),
    [pathTitle]
  );

  // Enrich steps with video data from course library
  const enrichedSteps = useMemo(() => {
    if (!pathResult?.path) return [];
    const steps = pathResult.path.map((step) => {
      const seg = step.segment || {};
      if (seg.videoUrl || seg.drive_id) return step;

      const matchedCourse = (courses || []).find(
        (c) =>
          (c.code && step.code && c.code === step.code) ||
          (c.title && step.title && c.title === step.title) ||
          (c.title && step.title && step.title.includes(c.title))
      );
      if (!matchedCourse) return step;

      const firstVideo = matchedCourse.videos?.[0];
      const driveId = firstVideo?.drive_id || "";
      const videoUrl =
        matchedCourse._url ||
        (driveId
          ? `https://drive.google.com/file/d/${driveId}/view`
          : "");

      return {
        ...step,
        videos: step.videos || matchedCourse.videos,
        // Carry over tags for display name generation
        tags: step.tags || matchedCourse.tags,
        canonical_tags: step.canonical_tags || matchedCourse.canonical_tags,
        ai_tags: step.ai_tags || matchedCourse.ai_tags,
        segment: {
          ...seg,
          videoUrl,
          drive_id: driveId,
          videoTitle:
            seg.videoTitle ||
            firstVideo?.title ||
            firstVideo?.name ||
            matchedCourse.title ||
            "",
        },
      };
    });
    return steps;
  }, [pathResult, courses]);

  // Process steps into display-ready data
  const stepData = useMemo(
    () => prepareStepData(enrichedSteps, pathResult?.bridges || []),
    [enrichedSteps, pathResult?.bridges]
  );

  // Group steps by section for sidebar
  const sections = useMemo(() => groupStepsBySection(stepData), [stepData]);

  // State
  const [viewMode, setViewMode] = useState("intro"); // "intro" | "lesson" | "quiz"
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});

  // Load saved progress on mount
  useEffect(() => {
    const progress = getProgress(pathId);
    setCompleted(progress.completedSteps);
    if (progress.lastStep > 0 && progress.lastStep < stepData.length) {
      setActiveStep(progress.lastStep);
      setViewMode("lesson");
    }
  }, [pathId, stepData.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (viewMode === "lesson") {
        if (e.key === "ArrowRight" && activeStep < stepData.length - 1) {
          handleNext();
        }
        if (e.key === "ArrowLeft" && activeStep > 0) {
          setActiveStep((prev) => prev - 1);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, stepData.length, viewMode]);

  const handleNext = useCallback(() => {
    const progress = markStepComplete(pathId, activeStep);
    setCompleted(new Set(progress.completedSteps));
    if (activeStep < stepData.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      // Completed final lesson → go to quiz
      setViewMode("quiz");
    }
  }, [pathId, activeStep, stepData.length]);

  const handlePrev = useCallback(() => {
    if (activeStep > 0) setActiveStep((prev) => prev - 1);
  }, [activeStep]);

  const handleStepClick = useCallback((idx) => {
    setActiveStep(idx);
    setViewMode("lesson");
  }, []);

  const handleStartLearning = useCallback(() => {
    setActiveStep(0);
    setViewMode("lesson");
  }, []);

  // Load quiz questions
  const handleLoadQuiz = useCallback(async () => {
    setQuizLoading(true);
    try {
      const quizMap = await generateQuizForPath(
        pathResult?.path || [],
        pathResult?.query || "",
        5
      );
      // Flatten all questions into a single array
      const allQuestions = [];
      for (const [, questions] of quizMap) {
        allQuestions.push(...questions);
      }
      setQuizQuestions(allQuestions);
    } catch {
      // Fallback: no quiz
      setQuizQuestions([]);
    }
    setQuizLoading(false);
  }, [pathResult]);

  const handleQuizAnswer = useCallback((questionIdx, answer) => {
    setQuizAnswers((prev) => ({ ...prev, [questionIdx]: answer }));
  }, []);

  // Current step data (for lesson mode)
  const current = stepData[activeStep];

  const completedCount = completed.size;
  const progressPct = stepData.length
    ? Math.round((completedCount / stepData.length) * 100)
    : 0;

  // Quiz score
  const quizScore = useMemo(() => {
    if (quizQuestions.length === 0) return null;
    const answered = Object.keys(quizAnswers).length;
    if (answered < quizQuestions.length) return null;
    const correct = quizQuestions.filter(
      (q, i) => quizAnswers[i] === q.correct
    ).length;
    return {
      correct,
      total: quizQuestions.length,
      pct: Math.round((correct / quizQuestions.length) * 100),
    };
  }, [quizQuestions, quizAnswers]);

  // Estimated time — prefer authored V2 estimate over heuristic
  const estimatedMinutes = useMemo(() => {
    if (pathResult?.v2Path?.estimatedMinutes) return pathResult.v2Path.estimatedMinutes;
    return stepData.length * 3;
  }, [stepData.length, pathResult]);

  return (
    <div className="wp-overlay">
      {/* ── Sidebar ── */}
      <div className={`wp-sidebar ${sidebarCollapsed ? "wp-sidebar-collapsed" : ""}`}>
        <div className="wp-sidebar-header">
          <h2 className="wp-sidebar-title">{pathTitle}</h2>
          <button
            className="wp-sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {/* Progress bar */}
            <div className="wp-progress">
              <div className="wp-progress-bar">
                <div
                  className="wp-progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="wp-progress-text">
                {completedCount}/{stepData.length} completed
              </span>
            </div>

            {/* Sidebar Navigation */}
            <nav className="wp-nav">
              {/* Intro link */}
              <button
                className={`wp-nav-item wp-nav-intro ${viewMode === "intro" ? "wp-nav-active" : ""}`}
                onClick={() => setViewMode("intro")}
              >
                <span className="wp-nav-num">🏠</span>
                <span className="wp-nav-label">Introduction</span>
              </button>

              {/* Grouped lesson sections */}
              {sections.map((section) => (
                <div key={section.id} className="wp-nav-section">
                  <div className="wp-nav-section-header">
                    <span>{section.label}</span>
                    <span className="wp-nav-section-count">{section.steps.length}</span>
                  </div>
                  {section.steps.map((step) => (
                    <button
                      key={step.globalIndex}
                      className={`wp-nav-item ${
                        viewMode === "lesson" && step.globalIndex === activeStep
                          ? "wp-nav-active"
                          : ""
                      } ${completed.has(step.globalIndex) ? "wp-nav-done" : ""}`}
                      onClick={() => handleStepClick(step.globalIndex)}
                    >
                      <span className="wp-nav-num">
                        {completed.has(step.globalIndex) ? "✓" : step.globalIndex + 1}
                      </span>
                      <span className="wp-nav-label">{step.title}</span>
                    </button>
                  ))}
                </div>
              ))}

              {/* Quiz link */}
              <button
                className={`wp-nav-item wp-nav-quiz ${viewMode === "quiz" ? "wp-nav-active" : ""}`}
                onClick={() => setViewMode("quiz")}
              >
                <span className="wp-nav-num">📝</span>
                <span className="wp-nav-label">Knowledge Check</span>
              </button>
            </nav>
          </>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="wp-main">
        {/* Toolbar */}
        <div className="wp-toolbar">
          <div className="wp-toolbar-left">
            <button className="wp-back-btn" onClick={onClose} title="Back to Path Builder">
              ← Back to Builder
            </button>
            <span className="wp-badge">🌐 Web Player</span>
            {viewMode === "lesson" && (
              <span className="wp-breadcrumb">
                Step {activeStep + 1} of {stepData.length}
              </span>
            )}
          </div>
          <button className="wp-close-btn" onClick={onClose} title="Close preview">
            ✕
          </button>
        </div>

        {/* ── INTRO VIEW ── */}
        {viewMode === "intro" && (
          <div className="wp-content wp-intro-content">
            {/* V2 LearnerView when available */}
            {pathResult?.v2Path?.schemaVersion === 2 ? (
              <LearnerView v2Path={pathResult.v2Path} />
            ) : (
              /* Legacy intro */
              <>
                <div className="wp-intro-hero">
                  <h1 className="wp-intro-title">{pathTitle}</h1>
                  <p className="wp-intro-subtitle">
                    {pathResult?.query
                      ? `A structured learning path covering ${pathResult.query}`
                      : "A curated learning experience in Unreal Engine 5"}
                  </p>
                </div>

                <div className="wp-intro-stats">
                  <div className="wp-intro-stat">
                    <span className="wp-intro-stat-value">{stepData.length}</span>
                    <span className="wp-intro-stat-label">Lessons</span>
                  </div>
                  <div className="wp-intro-stat">
                    <span className="wp-intro-stat-value">~{estimatedMinutes}m</span>
                    <span className="wp-intro-stat-label">Estimated Time</span>
                  </div>
                  <div className="wp-intro-stat">
                    <span className="wp-intro-stat-value">{sections.length}</span>
                    <span className="wp-intro-stat-label">Sections</span>
                  </div>
                </div>

                <div className="wp-intro-sections">
                  <h2>What You'll Learn</h2>
                  {sections.map((section) => (
                    <div key={section.id} className="wp-intro-section-card">
                      <h3>{section.label}</h3>
                      <ul>
                        {section.steps.slice(0, 5).map((step) => (
                          <li key={step.globalIndex}>{step.title}</li>
                        ))}
                        {section.steps.length > 5 && (
                          <li className="wp-intro-more">
                            +{section.steps.length - 5} more lessons
                          </li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button className="wp-intro-cta" onClick={handleStartLearning}>
              🚀 Begin Learning
            </button>
          </div>
        )}

        {/* ── LESSON VIEW ── */}
        {viewMode === "lesson" && (
          <div className="wp-content">
            {/* V2 paths → unified LearnerView with focused-step navigation */}
            {pathResult?.v2Path?.schemaVersion === 2 ? (
              <LearnerView
                v2Path={pathResult.v2Path}
                focusedStepIndex={activeStep}
                showIntro={false}
                externalProgress={completed}
                onStepChange={(idx) => {
                  // Mark current step complete before advancing
                  if (idx > activeStep) {
                    const progress = markStepComplete(pathId, activeStep);
                    setCompleted(new Set(progress.completedSteps));
                  }
                  setActiveStep(idx);
                }}
                onComplete={() => {
                  const progress = markStepComplete(pathId, activeStep);
                  setCompleted(new Set(progress.completedSteps));
                  setViewMode("quiz");
                }}
              />
            ) : (
              /* Legacy lesson renderer for non-V2 paths */
              <>
                {current && (
                  <>
                    <h1 className="wp-step-title">{current.title}</h1>

                    {/* Bridge narration */}
                    {current.bridgeText && (
                      <div className="wp-bridge">
                        <strong>Connection:</strong> {current.bridgeText}
                      </div>
                    )}

                    {/* Video embed */}
                    {current.video && (
                      <div className="wp-video-section">
                        <h2>🎬 Video Reference</h2>
                        <div className="wp-video-embed">
                          {current.video.driveId ? (
                            <iframe
                              src={`https://drive.google.com/file/d/${current.video.driveId}/preview`}
                              allow="autoplay"
                              allowFullScreen
                              title={current.video.videoTitle || current.title}
                            />
                          ) : current.video.youtubeId ? (
                            <iframe
                              src={`https://www.youtube-nocookie.com/embed/${current.video.youtubeId}?rel=0&modestbranding=1${current.video.startSec ? `&start=${current.video.startSec}` : ""}`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              title={current.video.videoTitle || current.title}
                            />
                          ) : null}
                        </div>
                        <div className="wp-video-meta">
                          {current.video.videoTitle && (
                            <span>{current.video.videoTitle}</span>
                          )}
                          {(current.video.startSec > 0 || current.video.endSec > 0) && (
                            <span className="wp-timestamp">
                              ⏱ {formatTime(current.video.startSec)} –{" "}
                              {formatTime(current.video.endSec)}
                            </span>
                          )}
                          {current.video.driveId && (
                            <a
                              href={`https://drive.google.com/file/d/${current.video.driveId}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open in Drive ↗
                            </a>
                          )}
                          {current.video.youtubeId && (
                            <a
                              href={`https://www.youtube.com/watch?v=${current.video.youtubeId}${current.video.startSec ? `&t=${current.video.startSec}` : ""}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Watch on YouTube ↗
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Step card */}
                    <div className="wp-step-card">
                      <div className="wp-step-meta">
                        <span className={`wp-category-badge ${getCategoryClass(current.category)}`}>
                          {current.category}
                        </span>
                        {current.source && <span>Source: {current.source}</span>}
                      </div>
                      {current.summary ? (
                        <p className="wp-step-summary">{current.summary}</p>
                      ) : (
                        <p className="wp-no-content">
                          <em>No content summary available for this step.</em>
                        </p>
                      )}
                    </div>

                    {/* Navigation buttons */}
                    <div className="wp-nav-buttons">
                      <button
                        className="wp-nav-btn wp-nav-secondary"
                        onClick={handlePrev}
                        disabled={activeStep === 0}
                      >
                        ← Previous
                      </button>
                      <button
                        className="wp-nav-btn wp-nav-primary"
                        onClick={handleNext}
                      >
                        {activeStep === stepData.length - 1
                          ? "✅ Complete & Take Quiz →"
                          : "Complete & Continue →"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── QUIZ VIEW ── */}
        {viewMode === "quiz" && (
          <div className="wp-content wp-quiz-content">
            <h1 className="wp-step-title">📝 Knowledge Check</h1>
            <p className="wp-quiz-intro">
              Test your understanding of the concepts covered in this learning path.
              You need 70% or higher to pass.
            </p>

            {quizQuestions.length === 0 && !quizLoading && (
              <div className="wp-quiz-start">
                <button className="wp-intro-cta" onClick={handleLoadQuiz}>
                  🧠 Generate Quiz Questions
                </button>
                <p className="wp-quiz-note">
                  Quiz questions are generated based on the lesson content using AI.
                </p>
              </div>
            )}

            {quizLoading && (
              <div className="wp-quiz-loading">
                <div className="wp-spinner" />
                <p>Generating quiz questions from lesson content...</p>
              </div>
            )}

            {quizQuestions.length > 0 && (
              <>
                {quizQuestions.map((q, i) => (
                  <QuizCard
                    key={i}
                    question={q}
                    index={i}
                    selectedAnswer={quizAnswers[i]}
                    onSelect={(answer) => handleQuizAnswer(i, answer)}
                  />
                ))}

                {quizScore && (
                  <div
                    className={`wp-quiz-score ${
                      quizScore.pct >= 70 ? "wp-quiz-passed" : "wp-quiz-failed"
                    }`}
                  >
                    <h2>
                      {quizScore.pct >= 70 ? "🎉 Congratulations!" : "📚 Keep Studying"}
                    </h2>
                    <p className="wp-quiz-score-text">
                      Score: {quizScore.correct}/{quizScore.total} ({quizScore.pct}%)
                    </p>
                    <p>
                      {quizScore.pct >= 70
                        ? "You passed the knowledge check! Great work."
                        : "You need 70% to pass. Review the lessons and try again."}
                    </p>
                    <button
                      className="wp-nav-btn wp-nav-secondary"
                      onClick={() => {
                        setQuizAnswers({});
                        setQuizQuestions([]);
                      }}
                    >
                      🔄 Retake Quiz
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

WebPlayerPreview.propTypes = {
  pathResult: PropTypes.object.isRequired,
  courses: PropTypes.array,
  onClose: PropTypes.func.isRequired,
};
