/**
 * AdaptivePath — Diagnostic quiz + depth-adjusted learning path
 *
 * Flow: INPUT → DIAGNOSING → PROFILE_READY → PATH_READY
 *
 * 1. User types a question
 * 2. Diagnostic quiz (3-5 narrowing questions) assesses knowledge
 * 3. Knowledge profile shows what they know vs gaps
 * 4. Generate a depth-adjusted BespokePath based on the profile
 */

import { useState, useCallback, useEffect } from "react";
import useAdaptiveQuiz from "../../hooks/useAdaptiveQuiz";
import { sanitizeQuery, checkRateLimit, recordQuery } from "../../services/securityGuardrails";
import { generateBespokePath } from "../../services/bespokePathService";
import { findCachedPath, cachePath } from "../../services/pathCacheService";
import PathStep from "../BespokePath/PathStep";
import QuizEngine from "../BespokePath/QuizEngine";
import {
  generateStepAudio,
  generateStepTakeaways,
  generateStepDeepDive,
} from "../../services/stepBriefingService";
import { generateQuizForStep } from "../../services/quizService";
import { cleanTitle } from "../../utils/cleanTitle";
import "../BespokePath/BespokePath.css";
import "./AdaptivePath.css";

/** Normalize known broken Epic Learning URL patterns */
function fixEpicUrl(url) {
  if (!url) return url;
  return url
    .replace("/learning/tutorial/", "/learning/tutorials/")
    .replace("/learning/knowledge_base/", "/learning/knowledge-base/")
    .replace("/learning/course/", "/learning/courses/")
    .replace("/learning/talks_and_demos/", "/learning/talks-and-demos/");
}

const DEFAULT_SUGGESTIONS = [
  "Why is my multiplayer character not replicating properly?",
  "How do I set up Gameplay Ability System from scratch?",
  "My landscape material looks tiled — how to fix it?",
  "How to optimize draw calls in a large open world?",
  "Why does my AI Behavior Tree keep failing?",
];

const LETTERS = ["A", "B", "C", "D"];

// Pipeline steps shown during path generation loading
const PIPELINE_STEPS = [
  { label: "Analyzing your question...", icon: "🔍", delay: 0 },
  { label: "Applying knowledge profile...", icon: "🧠", delay: 1500 },
  { label: "Searching course transcripts...", icon: "📚", delay: 3500 },
  { label: "Matching relevant lessons...", icon: "🎯", delay: 5500 },
  { label: "Building your learning sequence...", icon: "✨", delay: 8000 },
];

export default function AdaptivePath() {
  const [query, setQuery] = useState("");
  const [pathData, setPathData] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState(null);

  // Step expansion / briefing state (mirrors BespokePath)
  const [expandedStep, setExpandedStep] = useState(null);
  const [stepAudio, setStepAudio] = useState({});
  const [pipelineStep, setPipelineStep] = useState(0);
  const [stepTakeaways, setStepTakeaways] = useState({});
  const [_pathNarration, setPathNarration] = useState(null);

  // Deep dive state
  const [stepDeepDives, setStepDeepDives] = useState({});

  // Voice selector
  const [voiceName, setVoiceName] = useState("Kore");

  // Quiz state
  const [quizzes, setQuizzes] = useState(new Map());
  const [quizLoading, setQuizLoading] = useState(null);
  const [quizScores, setQuizScores] = useState(new Map());
  const [showQuiz, setShowQuiz] = useState(null);

  const {
    stage,
    questions,
    currentIndex,
    currentQuestion,
    knowledgeProfile,
    error: quizError,
    startDiagnostic,
    submitAnswer,
    reset,
    STAGES,
  } = useAdaptiveQuiz();

  /**
   * Handle starting the diagnostic quiz
   */
  const handleStart = useCallback(async () => {
    const result = sanitizeQuery(query);
    if (!result.valid) return;

    const cleaned = result.sanitized;
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) return;

    recordQuery(cleaned);
    startDiagnostic(cleaned);
  }, [query, startDiagnostic]);

  /**
   * After diagnostic, generate the depth-adjusted path
   */
  const handleGeneratePath = useCallback(async () => {
    if (!knowledgeProfile) return;

    setPathLoading(true);
    setPathError(null);
    setPipelineStep(0);

    // Animate pipeline steps during generation
    const timers = PIPELINE_STEPS.slice(1).map((step, i) =>
      setTimeout(() => setPipelineStep(i + 1), step.delay)
    );

    try {
      // Check cache first (include profile hash in cache key)
      const profileKey = `${query}_adaptive_${knowledgeProfile.level}`;
      const cached = await findCachedPath(profileKey);
      if (cached) {
        timers.forEach(clearTimeout);
        setPathData(cached);
        setPathLoading(false);
        return;
      }

      // Generate path with knowledge profile context
      const result = await generateBespokePath(query, knowledgeProfile);

      if (result.error) {
        setPathError(result.error);
      } else {
        setPathData(result);
        cachePath(profileKey, result);
      }
    } catch (err) {
      setPathError(err.message || "Failed to generate learning path.");
    } finally {
      timers.forEach(clearTimeout);
      setPathLoading(false);
    }
  }, [query, knowledgeProfile]);

  /**
   * Start over completely
   */
  const handleReset = useCallback(() => {
    reset();
    setQuery("");
    setPathData(null);
    setPathError(null);
    setPathLoading(false);
    setExpandedStep(null);

    setStepAudio({});
    setStepTakeaways({});
    setStepDeepDives({});
    setPathNarration(null);
    setQuizzes(new Map());
    setQuizScores(new Map());
    setShowQuiz(null);
  }, [reset]);

  // Generate quiz for the full path (on-demand)
  const handleTakeQuiz = useCallback(
    async (stepIndex) => {
      if (quizzes.has(stepIndex)) {
        setShowQuiz(stepIndex);
        return;
      }
      if (!pathData) return;
      setQuizLoading(stepIndex);

      // Aggregate ALL step content for a comprehensive quiz
      const aggregatedStep = {
        summary: pathData.path
          .map((s) => (s.summary || s.segment?.text || "").substring(0, 400))
          .join("\n\n"),
        segment: pathData.path[0]?.segment,
        category: "comprehensive",
      };

      const questions = await generateQuizForStep(aggregatedStep, pathData.query || query, 3);
      setQuizzes((prev) => new Map(prev).set(stepIndex, questions));
      setQuizLoading(null);
      setShowQuiz(stepIndex);
    },
    [quizzes, pathData, query]
  );

  // Handle quiz completion
  const handleQuizComplete = useCallback(({ stepIndex, score, total }) => {
    setQuizScores((prev) => new Map(prev).set(stepIndex, { score, total }));
    setShowQuiz(null);
  }, []);

  // Audio/takeaway handlers (same pattern as BespokePath)
  const handleStepAudio = useCallback(
    async (index, step) => {
      if (stepAudio[index]?.url || stepAudio[index]?.loading) return;
      setStepAudio((prev) => ({ ...prev, [index]: { loading: true } }));

      // Determine position in path for greeting/outro control
      const totalSteps = pathData?.path?.length ?? 0;
      const stepPosition = index === 0 ? "first" : index >= totalSteps - 1 ? "last" : "middle";

      // Collect source links for further reading (used in last step narration)
      const sourceLinks =
        stepPosition === "last" && pathData?.path
          ? pathData.path
              .map((s) => ({
                title: s.segment?.title || s.segment?.videoTitle || "",
                url: fixEpicUrl(s.segment?.videoUrl || s.segment?.url || ""),
              }))
              .filter((s) => s.title)
          : [];

      try {
        const audioUrl = await generateStepAudio(step, query, {
          stepPosition,
          sourceLinks,
          voiceName,
        });
        setStepAudio((prev) => ({ ...prev, [index]: { url: audioUrl || null, loading: false } }));

        // Pre-generate next step's audio in background
        const nextIdx = index + 1;
        if (nextIdx < totalSteps && !stepAudio[nextIdx]) {
          const nextPosition = nextIdx >= totalSteps - 1 ? "last" : "middle";
          generateStepAudio(pathData.path[nextIdx], query, {
            stepPosition: nextPosition,
            voiceName,
          })
            .then((nextUrl) => {
              setStepAudio((prev) => {
                if (prev[nextIdx]) return prev;
                return { ...prev, [nextIdx]: { url: nextUrl || null, loading: false } };
              });
            })
            .catch(() => {});
        }
      } catch {
        setStepAudio((prev) => ({ ...prev, [index]: { error: true, loading: false } }));
      }
    },
    [query, stepAudio, pathData, voiceName]
  );

  // Auto-advance to next step when audio finishes playing
  const handleAudioEnded = useCallback(() => {
    const cur = expandedStep ?? 0;
    const total = pathData?.path?.length ?? 0;
    if (cur < total - 1) {
      setExpandedStep(cur + 1);
    }
  }, [expandedStep, pathData]);

  const handleStepTakeaways = useCallback(
    async (index, step) => {
      if (stepTakeaways[index]) return;
      setStepTakeaways((prev) => ({ ...prev, [index]: { loading: true } }));
      try {
        const result = await generateStepTakeaways(step, query);
        setStepTakeaways((prev) => ({
          ...prev,
          [index]: { items: result, loading: false },
        }));
      } catch {
        setStepTakeaways((prev) => ({
          ...prev,
          [index]: { error: true, loading: false },
        }));
      }
    },
    [query, stepTakeaways]
  );

  // Auto-generate takeaways for all steps when path loads
  useEffect(() => {
    if (!pathData?.path || pathData.path.length === 0) return;
    pathData.path.forEach((step, index) => {
      if (!stepTakeaways[index]) {
        handleStepTakeaways(index, step);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathData]);

  // ── RENDER: Input Stage ──
  if (stage === STAGES.IDLE) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-input-section">
          <h1 className="adaptive-title">🎯 Adaptive Learning Path</h1>
          <p className="adaptive-subtitle">
            Tell us what you want to learn about. We&apos;ll start with a quick diagnostic to
            understand what you already know, then build a personalized path that goes deep where it
            matters most.
          </p>

          <div className="adaptive-input-wrapper">
            <textarea
              className="adaptive-textarea"
              placeholder="Describe what you want to learn or the problem you're facing..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleStart();
                }
              }}
            />
            <button className="adaptive-start-btn" onClick={handleStart} disabled={!query.trim()}>
              🎯 Generate Path
            </button>

            <div className="adaptive-pills">
              <span className="adaptive-pills-label">Suggested:</span>
              {DEFAULT_SUGGESTIONS.map((s, i) => (
                <button key={i} className="adaptive-pill" onClick={() => setQuery(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Loading (generating questions) ──
  if (stage === STAGES.LOADING) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-loading">
          <div className="adaptive-loading-spinner" />
          <p className="adaptive-loading-text">
            Analyzing your topic and preparing diagnostic questions...
          </p>
        </div>
      </div>
    );
  }

  // ── RENDER: Error ──
  if (stage === STAGES.ERROR) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-error">
          <p className="adaptive-error-msg">⚠️ {quizError}</p>
          <button className="adaptive-retry-btn" onClick={handleReset}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: Diagnostic Quiz ──
  if (stage === STAGES.QUIZZING && currentQuestion) {
    const progress = ((currentIndex + 1) / questions.length) * 100;

    return (
      <div className="adaptive-path">
        <div className="diagnostic-quiz">
          <div className="diagnostic-header">
            <h2>📋 Knowledge Diagnostic</h2>
            <p>Answer these questions so we can personalize your learning path</p>
          </div>

          <div className="diagnostic-progress">
            <div className="diagnostic-progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <div className="diagnostic-card" key={currentIndex}>
            <div className="diagnostic-question-num">
              Question {currentIndex + 1} of {questions.length}
            </div>

            {currentQuestion.concept && (
              <span className="diagnostic-concept-tag">
                {currentQuestion.concept.replace(/_/g, " ")}
              </span>
            )}

            <p className="diagnostic-question-text">{currentQuestion.q}</p>

            <div className="diagnostic-options">
              {currentQuestion.options.map((option, optIdx) => (
                <button
                  key={optIdx}
                  className="diagnostic-option"
                  onClick={() => submitAnswer(optIdx)}
                >
                  <span className="diagnostic-option-letter">{LETTERS[optIdx]}</span>
                  {option}
                </button>
              ))}

              <button className="diagnostic-unsure" onClick={() => submitAnswer(-1)}>
                🤔 I&apos;m not sure
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Knowledge Profile (quiz complete, path not yet generated) ──
  if (stage === STAGES.COMPLETE && knowledgeProfile && !pathData && !pathLoading) {
    return (
      <div className="adaptive-path">
        <div className="knowledge-summary">
          <h2>📊 Your Knowledge Profile</h2>
          <p>Based on your diagnostic, here&apos;s what we found:</p>

          <span className={`knowledge-level-badge ${knowledgeProfile.level}`}>
            {knowledgeProfile.level.charAt(0).toUpperCase() + knowledgeProfile.level.slice(1)} Level
          </span>

          <div className="knowledge-lists">
            <div className="knowledge-list knows">
              <h3>✅ You Know</h3>
              <ul>
                {knowledgeProfile.knows.length > 0 ? (
                  knowledgeProfile.knows.map((c, i) => <li key={i}>{c.replace(/_/g, " ")}</li>)
                ) : (
                  <li style={{ fontStyle: "italic" }}>No strong areas detected</li>
                )}
              </ul>
            </div>
            <div className="knowledge-list gaps">
              <h3>🔍 Gaps to Fill</h3>
              <ul>
                {knowledgeProfile.gaps.length > 0 ? (
                  knowledgeProfile.gaps.map((c, i) => <li key={i}>{c.replace(/_/g, " ")}</li>)
                ) : (
                  <li style={{ fontStyle: "italic" }}>No gaps detected — nice!</li>
                )}
              </ul>
            </div>
          </div>

          <button className="adaptive-generate-btn" onClick={handleGeneratePath}>
            ✨ Generate Personalized Path
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: Path loading with pipeline steps ──
  if (pathLoading) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-loading">
          <div className="adaptive-loading-spinner" />
          <div className="adaptive-pipeline-steps">
            {PIPELINE_STEPS.map((step, i) => (
              <div
                key={i}
                className={`pipeline-step ${
                  i < pipelineStep ? "done" : i === pipelineStep ? "active" : "pending"
                }`}
              >
                <span className="pipeline-icon">{step.icon}</span>
                <span className="pipeline-label">{step.label}</span>
                {i < pipelineStep && <span className="pipeline-check">✓</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER: Path error ──
  if (pathError) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-error">
          <p className="adaptive-error-msg">⚠️ {pathError}</p>
          <button className="adaptive-retry-btn" onClick={handleReset}>
            Start Over
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER: Path ready (BespokePath-style modal overlay) ──
  if (pathData && pathData.path) {
    // Group steps into phases (same logic as BespokePath)
    const PHASE_CONFIG = [
      { key: "problem", icon: "📋", label: "Questions", categories: ["foundation", "diagnosis"] },
      { key: "solution", icon: "🔧", label: "Solution", categories: ["fix"] },
      { key: "apply", icon: "🚀", label: "Apply It", categories: ["transfer"] },
      { key: "quiz", icon: "📝", label: "Quiz", categories: ["__quiz__"] },
      { key: "reading", icon: "📖", label: "Further Reading", categories: ["__reading__"] },
    ];

    const phases = [];
    for (const config of PHASE_CONFIG) {
      if (config.key === "quiz") {
        // Quiz is a virtual phase, always include it
        phases.push({ ...config, steps: [{ category: "__quiz__", globalIndex: -2 }] });
        continue;
      }
      if (config.key === "reading") {
        // Further Reading is a virtual phase, always include it
        phases.push({ ...config, steps: [{ category: "__reading__", globalIndex: -3 }] });
        continue;
      }
      const steps = pathData.path
        .map((s, i) => ({ ...s, globalIndex: i }))
        .filter((s) => config.categories.includes(s.category));
      if (steps.length > 0) {
        phases.push({ ...config, steps });
      }
    }

    const activePhaseKey =
      expandedStep === -2
        ? "quiz"
        : expandedStep === -3
          ? "reading"
          : phases.find((p) => p.steps.some((s) => s.globalIndex === (expandedStep ?? 0)))?.key ||
            "";

    return (
      <div className="adaptive-path bespoke-path">
        <div className="path-modal-overlay">
          <div className="path-modal-container">
            <button className="path-modal-close" onClick={handleReset}>
              <i className="fa-solid fa-xmark"></i>
            </button>

            {/* Sidebar Navigation */}
            <aside className="epic-sidebar">
              <div className="sidebar-title">
                🎯 Adaptive Path
                <span
                  style={{
                    display: "block",
                    fontSize: "0.65rem",
                    color: "var(--accent-orange)",
                    marginTop: "4px",
                  }}
                >
                  {knowledgeProfile?.level} level
                </span>
              </div>
              <nav className="phase-nav">
                {phases.map((phase) => (
                  <div key={phase.key} className="phase-group">
                    <button
                      className={`phase-nav-item ${activePhaseKey === phase.key ? "active" : ""}`}
                      onClick={() => {
                        if (phase.key === "quiz") {
                          setExpandedStep(-2);
                        } else if (phase.key === "reading") {
                          setExpandedStep(-3);
                        } else {
                          const idx = phase.steps[0]?.globalIndex ?? 0;
                          setExpandedStep(idx);
                        }
                      }}
                    >
                      {phase.label}
                    </button>
                    {/* Substep list — only for real content phases */}
                    {phase.key !== "quiz" && phase.key !== "reading" && phase.steps.length > 0 && (
                      <ul className="substep-list">
                        {phase.steps.map((substep, i) => {
                          const step = pathData.path[substep.globalIndex];
                          let rawTitle =
                            cleanTitle(step?.segment?.title || step?.segment?.videoTitle) ||
                            `Step ${i + 1}`;
                          const shortTitle =
                            rawTitle.length > 40 ? rawTitle.substring(0, 38) + "…" : rawTitle;
                          return (
                            <li key={substep.globalIndex}>
                              <button
                                className={`substep-item ${(expandedStep ?? 0) === substep.globalIndex ? "active" : ""}`}
                                onClick={() => setExpandedStep(substep.globalIndex)}
                                title={rawTitle}
                              >
                                {i + 1}. {shortTitle}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </nav>
              <div className="voice-selector">
                <label className="voice-label" htmlFor="voice-select">
                  🎤 Narrator Voice
                </label>
                <select
                  id="voice-select"
                  className="voice-dropdown"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                >
                  <option value="Kore">Kore (Female)</option>
                  <option value="Aoede">Aoede (Female)</option>
                  <option value="Leda">Leda (Female)</option>
                  <option value="Puck">Puck (Male)</option>
                  <option value="Charon">Charon (Male)</option>
                  <option value="Fenrir">Fenrir (Male)</option>
                  <option value="Orus">Orus (Male)</option>
                  <option value="Zephyr">Zephyr (Neutral)</option>
                </select>
              </div>
            </aside>

            {/* Main Content Area */}
            <main className="epic-main-content">
              <div className="main-scroll-area">
                {/* Knowledge profile banner */}
                {knowledgeProfile?.gaps.length > 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "8px 16px",
                      fontSize: "0.75rem",
                      color: "var(--accent-orange)",
                      borderBottom: "1px solid var(--border-color)",
                    }}
                  >
                    Deep focus on:{" "}
                    {knowledgeProfile.gaps.map((g) => g.replace(/_/g, " ")).join(", ")}
                  </div>
                )}

                {expandedStep === -2 ? (
                  <div className="quiz-phase-container">
                    <div className="step-article">
                      <h1>Knowledge Check</h1>
                      <p>Test your understanding of the concepts covered in this path.</p>

                      {(() => {
                        const quizIdx = 0;

                        if (showQuiz === quizIdx && quizzes.has(quizIdx)) {
                          return (
                            <QuizEngine
                              questions={quizzes.get(quizIdx)}
                              stepIndex={quizIdx}
                              onComplete={handleQuizComplete}
                            />
                          );
                        }

                        if (quizScores.has(quizIdx)) {
                          return (
                            <div className="quiz-score-badge">
                              ✅ Quiz: {quizScores.get(quizIdx).score}/
                              {quizScores.get(quizIdx).total}
                            </div>
                          );
                        }

                        return (
                          <button
                            className="take-quiz-btn"
                            onClick={() => handleTakeQuiz(quizIdx)}
                            disabled={quizLoading === quizIdx}
                          >
                            {quizLoading === quizIdx ? "Generating quiz..." : "Take Quiz"}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                ) : expandedStep === -3 ? (
                  /* Further Reading phase */
                  <div className="quiz-phase-container">
                    <div className="step-article">
                      <h1>📖 Further Reading</h1>
                      <p>
                        Dive deeper into the topics covered in this path with these source
                        materials.
                      </p>
                      <div
                        className="further-reading-list"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          marginTop: "20px",
                        }}
                      >
                        {pathData.path.map((step, i) => {
                          const url = fixEpicUrl(step.segment?.videoUrl || step.segment?.url);
                          const title =
                            cleanTitle(step.segment?.title || step.segment?.videoTitle) ||
                            `Step ${i + 1}`;
                          const sourceType = step.segment?.type || step.segment?.source || "docs";
                          const icon = sourceType === "transcript" ? "fa-video" : "fa-book-open";
                          const typeLabel =
                            sourceType === "transcript"
                              ? "Video"
                              : sourceType === "epic_learning"
                                ? "Article"
                                : "Docs";
                          return (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "14px 18px",
                                background: "rgba(88, 166, 255, 0.06)",
                                border: "1px solid var(--border-color, #30363d)",
                                borderRadius: "10px",
                                color: "var(--accent-blue, #58a6ff)",
                                textDecoration: "none",
                                transition: "all 0.2s",
                                fontSize: "0.9rem",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(88, 166, 255, 0.12)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(88, 166, 255, 0.06)";
                              }}
                            >
                              <i
                                className={`fa-solid ${icon}`}
                                style={{ fontSize: "1.1rem", width: "20px" }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500 }}>{title}</div>
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-secondary)",
                                    marginTop: "2px",
                                  }}
                                >
                                  {typeLabel} • Step {i + 1}
                                </div>
                              </div>
                              <i
                                className="fa-solid fa-arrow-up-right-from-square"
                                style={{ opacity: 0.5, fontSize: "0.8rem" }}
                              />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (expandedStep ?? 0) >= 0 && (expandedStep ?? 0) < pathData.path.length ? (
                  <div className="step-content-container">
                    <PathStep
                      step={pathData.path[expandedStep ?? 0]}
                      isActive={true}
                      takeaways={stepTakeaways[expandedStep ?? 0]?.items}
                      takeawayLoading={!!stepTakeaways[expandedStep ?? 0]?.loading}
                      stepAudioUrl={stepAudio[expandedStep ?? 0]?.url}
                      stepAudioLoading={!!stepAudio[expandedStep ?? 0]?.loading}
                      autoPlayAudio={!!stepAudio[expandedStep ?? 0]?.url}
                      onAudioEnded={handleAudioEnded}
                      onGenerateNarration={() =>
                        handleStepAudio(expandedStep ?? 0, pathData.path[expandedStep ?? 0])
                      }
                      onGenerateAudio={() =>
                        handleStepAudio(expandedStep ?? 0, pathData.path[expandedStep ?? 0])
                      }
                      deepDive={stepDeepDives[expandedStep ?? 0]?.sections}
                      deepDiveLoading={!!stepDeepDives[expandedStep ?? 0]?.loading}
                      onGoDeeper={async () => {
                        const idx = expandedStep ?? 0;
                        const step = pathData.path[idx];
                        setStepDeepDives((prev) => ({
                          ...prev,
                          [idx]: { loading: true },
                        }));
                        const sections = await generateStepDeepDive(step, query, {
                          userLevel: knowledgeProfile?.level || "intermediate",
                        });
                        setStepDeepDives((prev) => ({
                          ...prev,
                          [idx]: { loading: false, sections: sections || [] },
                        }));
                      }}
                    />
                  </div>
                ) : null}
              </div>

              {/* Footer Navigation */}
              <footer className="epic-footer">
                <button
                  className="nav-btn"
                  onClick={() => {
                    if (expandedStep === -3) {
                      setExpandedStep(-2); // From reading, go back to quiz
                    } else if (expandedStep === -2) {
                      setExpandedStep(pathData.path.length - 1); // From quiz, go to last step
                    } else {
                      const cur = expandedStep ?? 0;
                      if (cur > 0) setExpandedStep(cur - 1);
                    }
                  }}
                  disabled={(expandedStep ?? 0) <= 0 && expandedStep !== -2 && expandedStep !== -3}
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <div className="footer-status">
                  {expandedStep === -2
                    ? "Quiz"
                    : expandedStep === -3
                      ? "Further Reading"
                      : `Step ${Math.min((expandedStep ?? 0) + 1, pathData.path.length)} of ${pathData.path.length}`}
                </div>
                <button
                  className="nav-btn"
                  onClick={() => {
                    const cur = expandedStep ?? 0;
                    if (cur < pathData.path.length - 1) {
                      setExpandedStep(cur + 1);
                    } else if (cur === pathData.path.length - 1) {
                      setExpandedStep(-2); // Last step → quiz
                    } else if (expandedStep === -2) {
                      setExpandedStep(-3); // Quiz → further reading
                    }
                  }}
                  disabled={expandedStep === -3}
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </footer>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
