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
import { generateStepAudio, generateStepTakeaways } from "../../services/stepBriefingService";
import "../BespokePath/BespokePath.css";
import "./AdaptivePath.css";

const DEFAULT_SUGGESTIONS = [
  "Why is my multiplayer character not replicating properly?",
  "How do I set up Gameplay Ability System from scratch?",
  "My landscape material looks tiled — how to fix it?",
  "How to optimize draw calls in a large open world?",
  "Why does my AI Behavior Tree keep failing?",
];

const LETTERS = ["A", "B", "C", "D"];

export default function AdaptivePath() {
  const [query, setQuery] = useState("");
  const [pathData, setPathData] = useState(null);
  const [pathLoading, setPathLoading] = useState(false);
  const [pathError, setPathError] = useState(null);

  // Step expansion / briefing state (mirrors BespokePath)
  const [expandedStep, setExpandedStep] = useState(null);
  const [stepAudio, setStepAudio] = useState({});
  const [stepTakeaways, setStepTakeaways] = useState({});
  const [quizStep, setQuizStep] = useState(null);
  const [_pathNarration, setPathNarration] = useState(null);

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

    try {
      // Check cache first (include profile hash in cache key)
      const profileKey = `${query}_adaptive_${knowledgeProfile.level}`;
      const cached = await findCachedPath(profileKey);
      if (cached) {
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
    setQuizStep(null);
    setPathNarration(null);
  }, [reset]);

  // Audio/takeaway handlers (same pattern as BespokePath)
  const handleStepAudio = useCallback(
    async (index, step) => {
      if (stepAudio[index]) return;
      setStepAudio((prev) => ({ ...prev, [index]: { loading: true } }));
      try {
        const audioUrl = await generateStepAudio(step, query);
        setStepAudio((prev) => ({ ...prev, [index]: { url: audioUrl || null, loading: false } }));
      } catch {
        setStepAudio((prev) => ({ ...prev, [index]: { error: true, loading: false } }));
      }
    },
    [query, stepAudio]
  );

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
              🧪 Start Diagnostic
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

  // ── RENDER: Path loading ──
  if (pathLoading) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-loading">
          <div className="adaptive-loading-spinner" />
          <p className="adaptive-loading-text">
            Building your personalized learning path based on your knowledge profile...
          </p>
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
    ];

    const phases = [];
    for (const config of PHASE_CONFIG) {
      const steps = pathData.path
        .map((s, i) => ({ ...s, globalIndex: i }))
        .filter((s) => config.categories.includes(s.category));
      if (steps.length > 0) {
        phases.push({ ...config, steps });
      }
    }

    const activePhaseKey =
      phases.find((p) => p.steps.some((s) => s.globalIndex === (expandedStep ?? 0)))?.key || "";

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
                        const idx = phase.steps[0]?.globalIndex ?? 0;
                        setExpandedStep(idx);
                      }}
                    >
                      {phase.label}
                    </button>
                    <ul className="substep-list">
                      {phase.steps.map((substep, i) => {
                        const step = pathData.path[substep.globalIndex];
                        let rawTitle =
                          step?.segment?.title || step?.segment?.videoTitle || `Step ${i + 1}`;
                        const shortTitle =
                          rawTitle.length > 35 ? rawTitle.substring(0, 33) + "…" : rawTitle;
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
                  </div>
                ))}
              </nav>
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

                {(expandedStep ?? 0) >= 0 && (expandedStep ?? 0) < pathData.path.length && (
                  <div className="step-content-container">
                    <PathStep
                      step={pathData.path[expandedStep ?? 0]}
                      isActive={true}
                      takeaways={stepTakeaways[expandedStep ?? 0]?.items}
                      takeawayLoading={!!stepTakeaways[expandedStep ?? 0]?.loading}
                      stepAudioUrl={stepAudio[expandedStep ?? 0]?.url}
                      stepAudioLoading={!!stepAudio[expandedStep ?? 0]?.loading}
                      onGenerateNarration={() =>
                        handleStepAudio(expandedStep ?? 0, pathData.path[expandedStep ?? 0])
                      }
                      onGenerateAudio={() =>
                        handleStepAudio(expandedStep ?? 0, pathData.path[expandedStep ?? 0])
                      }
                    />
                  </div>
                )}
              </div>

              {/* Footer Navigation */}
              <footer className="epic-footer">
                <button
                  className="nav-btn"
                  onClick={() => {
                    const cur = expandedStep ?? 0;
                    if (cur > 0) setExpandedStep(cur - 1);
                  }}
                  disabled={(expandedStep ?? 0) <= 0}
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <div className="footer-status">
                  Step {Math.min((expandedStep ?? 0) + 1, pathData.path.length)} of{" "}
                  {pathData.path.length}
                </div>
                <button
                  className="nav-btn"
                  onClick={() => {
                    const cur = expandedStep ?? 0;
                    if (cur < pathData.path.length - 1) setExpandedStep(cur + 1);
                  }}
                  disabled={(expandedStep ?? 0) >= pathData.path.length - 1}
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </footer>
            </main>
          </div>
        </div>

        {/* Quiz overlay */}
        {quizStep !== null && pathData.path[quizStep] && (
          <QuizEngine
            step={pathData.path[quizStep]}
            query={query}
            onClose={() => setQuizStep(null)}
          />
        )}
      </div>
    );
  }

  return null;
}
