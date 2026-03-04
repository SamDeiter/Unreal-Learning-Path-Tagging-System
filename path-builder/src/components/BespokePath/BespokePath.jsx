/**
 * BespokePath — AI-generated "Fix a Problem" learning path UI
 *
 * Renders the full bespoke path experience:
 * 1. Query input → 2. Loading pipeline → 3. Sequenced path with bridge narrations
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { generateBespokePath } from "../../services/bespokePathService";
import { generateQuizForStep } from "../../services/quizService";
import { findCachedPath, cachePath, addToHistory } from "../../services/pathCacheService";
import { sanitizeQuery, checkRateLimit, recordQuery } from "../../services/securityGuardrails";
import PRE_SEEDED_PATHS from "../../data/preSeededPaths";
import PathStep from "./PathStep";
import QuizEngine from "./QuizEngine";
import PreSeededPaths from "./PreSeededPaths";
import {
  generateStepAudio,
  generateStepTakeaways,
  generatePathNarration,
} from "../../services/stepBriefingService";
import "./BespokePath.css";

import {
  startSession,
  trackEvent,
  trackQuerySubmitted,
  trackFollowupQuery,
  EVENTS,
} from "../../services/analyticsService";

const EXAMPLE_QUERIES = [
  "How do I fix character animation jittering in multiplayer?",
  "Why does my material look different in Lumen vs path tracing?",
  "How to optimize Nanite meshes for open world performance?",
  "Setting up Gameplay Ability System for a melee combat game",
  "Why is my landscape material tiling so visible at distance?",
];

// ── Phase Grouping ──────────────────────────────────────
// Maps step categories to the 4-phase pedagogical flow
const PHASE_CONFIG = [
  { key: "problem", icon: "📋", label: "Questions", categories: ["foundation", "diagnosis"] },
  { key: "solution", icon: "🔧", label: "Solution", categories: ["fix"] },
  { key: "quiz", icon: "📝", label: "Quiz", categories: ["__quiz__"] },
  { key: "apply", icon: "🚀", label: "Apply It", categories: ["transfer"] },
];

/**
 * Group path steps into the 4-phase flow and inject a virtual quiz phase.
 * Returns: [{ phase, icon, label, steps: [{ ...step, globalIndex }] }]
 */
function groupStepsIntoPhases(path) {
  const phases = [];

  // Problem phase: foundation + diagnosis
  const problemSteps = path
    .map((s, i) => ({ ...s, globalIndex: i }))
    .filter((s) => ["foundation", "diagnosis"].includes(s.category));
  if (problemSteps.length > 0) {
    phases.push({ ...PHASE_CONFIG[0], steps: problemSteps });
  }

  // Solution phase: fix steps
  const solutionSteps = path
    .map((s, i) => ({ ...s, globalIndex: i }))
    .filter((s) => s.category === "fix");
  if (solutionSteps.length > 0) {
    phases.push({ ...PHASE_CONFIG[1], steps: solutionSteps });
  }

  // Quiz phase: virtual (no actual steps from API)
  phases.push({ ...PHASE_CONFIG[2], steps: [{ category: "__quiz__", globalIndex: -2 }] });

  // Apply It phase: transfer steps
  const applySteps = path
    .map((s, i) => ({ ...s, globalIndex: i }))
    .filter((s) => s.category === "transfer");
  if (applySteps.length > 0) {
    phases.push({ ...PHASE_CONFIG[3], steps: applySteps });
  }

  return phases;
}

export default function BespokePath() {
  const [query, setQuery] = useState("");
  const [pathResult, setPathResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [pipelineStage, setPipelineStage] = useState("");
  const [inputError, setInputError] = useState("");

  // Quiz state
  const [quizzes, setQuizzes] = useState(new Map()); // stepIndex → questions[]
  const [quizLoading, setQuizLoading] = useState(null); // stepIndex currently loading
  const [quizScores, setQuizScores] = useState(new Map()); // stepIndex → {score, total}
  const [showQuiz, setShowQuiz] = useState(null); // stepIndex showing quiz

  // Per-step audio and takeaways state
  const [stepAudios, setStepAudios] = useState(new Map());
  const [stepAudioLoading, setStepAudioLoading] = useState(null);
  const [stepTakeaways, setStepTakeaways] = useState(new Map());
  const [takeawayLoading, setTakeawayLoading] = useState(null);

  // Path Narrator state (button-triggered, not auto)
  const [narrationData, setNarrationData] = useState(null); // Map<stepIndex, {script, audioUrl}>
  const [narrationLoading, setNarrationLoading] = useState(false);

  const isFollowUp = useRef(false);

  // Start analytics session on mount
  useEffect(() => {
    startSession();
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    // Security: validate + sanitize input
    const { valid, sanitized, error: sanitizeError } = sanitizeQuery(trimmed);
    if (!valid) {
      setInputError(sanitizeError);
      return;
    }
    setInputError("");

    // Security: rate limit check
    const { allowed, error: rateError } = checkRateLimit();
    if (!allowed) {
      setInputError(rateError);
      return;
    }

    recordQuery();

    // Track analytics
    if (isFollowUp.current) {
      trackFollowupQuery(pathResult?.query || "", sanitized);
    }
    trackQuerySubmitted(sanitized, []);
    isFollowUp.current = true;
    setIsLoading(true);
    setPathResult(null);
    setCurrentStep(-1);
    setQuizzes(new Map());
    setQuizScores(new Map());
    setShowQuiz(null);

    // 1. Check cache first (zero cost)
    setPipelineStage("Checking cache...");
    const cached = findCachedPath(trimmed);
    if (cached) {
      setPipelineStage("Found cached path!");
      trackEvent(EVENTS.LEARNING_PATH_GENERATED, {
        query: trimmed,
        step_count: cached.path?.length || 0,
        from_cache: true,
      });
      setPathResult({ ...cached, fromCache: true });
      addToHistory(trimmed, cached);
      setCurrentStep(0);
      setIsLoading(false);
      setPipelineStage("");
      return;
    }

    // 2. Generate fresh path via AI pipeline
    setPipelineStage("Finding relevant content...");
    const result = await generateBespokePath(sanitized);

    if (!result.error && result.path.length > 0) {
      setPipelineStage("Path ready!");
      trackEvent(EVENTS.LEARNING_PATH_GENERATED, {
        query: sanitized,
        step_count: result.path?.length || 0,
        from_cache: false,
      });
      cachePath(trimmed, result);
      addToHistory(trimmed, result);
    }

    setPathResult(result);
    setCurrentStep(0);
    setIsLoading(false);
    setPipelineStage("");
    // Also reset quizzes and scores for new search
    setQuizzes(new Map());
    setQuizScores(new Map());
  }, [query, isLoading, pathResult?.query]);

  // Generate quiz for a specific step (on-demand)
  const handleTakeQuiz = useCallback(
    async (stepIndex) => {
      if (quizzes.has(stepIndex) || !pathResult) {
        setShowQuiz(stepIndex);
        return;
      }
      setQuizLoading(stepIndex);
      const questions = await generateQuizForStep(pathResult.path[stepIndex], pathResult.query, 2);
      setQuizzes((prev) => new Map(prev).set(stepIndex, questions));
      setQuizLoading(null);
      setShowQuiz(stepIndex);
    },
    [quizzes, pathResult]
  );

  // Handle quiz completion for a step
  const handleQuizComplete = useCallback(({ stepIndex, score, total }) => {
    setQuizScores((prev) => new Map(prev).set(stepIndex, { score, total }));
    setShowQuiz(null);
  }, []);

  // Handle selecting a pre-seeded path (zero API cost)
  const handlePreSeededSelect = useCallback((path) => {
    // Convert pre-seeded format to the same shape as generateBespokePath output
    const fakeResult = {
      query: path.query,
      path: path.steps.map((step, i) => ({
        category: step.category,
        segment: {
          id: `${path.id}-step-${i}`,
          title: step.title,
          summary: step.summary,
          source: step.sourceType,
          text: step.summary,
        },
      })),
      bridges: path.steps.slice(1).map((_, i) => ({
        from: i,
        to: i + 1,
        text: "", // No bridge narration for pre-seeded
      })),
      segments: path.steps,
      generatedAt: new Date().toISOString(),
      isPreSeeded: true,
    };
    setPathResult(fakeResult);
    addToHistory(path.query, fakeResult);
    setQuery(path.query);
    setCurrentStep(0);
    setQuizzes(new Map());
    setQuizScores(new Map());
    setShowQuiz(null);
  }, []);

  // Generate per-step audio on demand
  const handleStepAudio = useCallback(
    async (stepIndex) => {
      if (stepAudios.has(stepIndex) || !pathResult) return;
      setStepAudioLoading(stepIndex);
      const url = await generateStepAudio(pathResult.path[stepIndex], pathResult.query || query);
      if (url) {
        setStepAudios((prev) => new Map(prev).set(stepIndex, url));
      }
      setStepAudioLoading(null);
    },
    [stepAudios, pathResult, query]
  );

  // Generate full path narration on demand (button-triggered)
  const handleGenerateNarration = useCallback(async () => {
    if (narrationData || narrationLoading || !pathResult) return;
    setNarrationLoading(true);
    const result = await generatePathNarration(pathResult, pathResult.query || query);
    if (result) {
      setNarrationData(result);
    }
    setNarrationLoading(false);
  }, [narrationData, narrationLoading, pathResult, query]);

  // Generate takeaways on demand when step becomes active
  const handleLoadTakeaways = useCallback(
    async (stepIndex) => {
      if (stepTakeaways.has(stepIndex) || !pathResult) return;
      setTakeawayLoading(stepIndex);
      const takeaways = await generateStepTakeaways(
        pathResult.path[stepIndex],
        pathResult.query || query
      );
      setStepTakeaways((prev) => new Map(prev).set(stepIndex, takeaways));
      setTakeawayLoading(null);
    },
    [stepTakeaways, pathResult, query]
  );

  // Auto-load takeaways when step changes
  useEffect(() => {
    if (pathResult && pathResult.path && currentStep >= 0) {
      // Ensure we don't trigger if already loaded or loading
      if (!stepTakeaways.has(currentStep) && takeawayLoading !== currentStep) {
        handleLoadTakeaways(currentStep);
      }
    }
  }, [currentStep, pathResult, handleLoadTakeaways, stepTakeaways, takeawayLoading]);

  const handleExampleClick = (example) => {
    setQuery(example);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="bespoke-path">
      {/* Query Input Section */}
      <div className="bespoke-hero">
        <h2 className="bespoke-title">
          <span className="bespoke-icon">🔧</span> Fix a Problem
        </h2>
        <p className="bespoke-subtitle">
          Describe your UE5 problem and get an expert-curated learning path with video clips, docs,
          and step-by-step guidance.
        </p>

        <div className="bespoke-input-area">
          <div className="bespoke-input-wrapper">
            <textarea
              className="bespoke-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (inputError) setInputError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="What UE5 problem are you trying to solve?"
              rows={2}
              maxLength={500}
              disabled={isLoading}
            />
            {/* Char counter */}
            {query.length > 400 && (
              <span
                className="char-counter"
                style={{ color: query.length >= 500 ? "#f85149" : "#8b949e" }}
              >
                {query.length}/500
              </span>
            )}
            <button
              className="bespoke-submit"
              onClick={handleGenerate}
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? <span className="bespoke-spinner" /> : "🚀 Generate Path"}
            </button>
          </div>

          {/* Example queries */}
          {!pathResult && !isLoading && (
            <div className="bespoke-examples">
              <span className="examples-label">Try:</span>
              {EXAMPLE_QUERIES.map((ex, i) => (
                <button key={i} className="example-chip" onClick={() => handleExampleClick(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input error message */}
        {inputError && (
          <div className="bespoke-input-error">
            <span>⚠️</span> {inputError}
          </div>
        )}

        {/* Pre-seeded popular paths (shown before first search) */}
        {!pathResult && !isLoading && (
          <PreSeededPaths paths={PRE_SEEDED_PATHS} onSelect={handlePreSeededSelect} />
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bespoke-loading">
          <div className="pipeline-indicator">
            <div className="pipeline-dots">
              <span className="dot active" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <p className="pipeline-stage">{pipelineStage}</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {pathResult?.error && (
        <div className="bespoke-error">
          <span className="error-icon">⚠️</span>
          <p>{pathResult.error}</p>
        </div>
      )}

      {/* Path Results — Modal Overlay */}
      {pathResult && !pathResult.error && pathResult.path.length > 0 && (
        <div className="path-modal-overlay">
          <div className="path-modal-container">
            <button
              className="path-modal-close"
              onClick={() => {
                setPathResult(null);
                setCurrentStep(0);
              }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            {/* Sidebar Navigation */}
            <aside className="epic-sidebar">
              <div className="sidebar-title">Learning Path</div>
              <nav className="phase-nav">
                {(() => {
                  const phases = groupStepsIntoPhases(pathResult.path);
                  const activePhaseKey =
                    currentStep === -2
                      ? "quiz"
                      : phases.find((p) => p.steps.some((s) => s.globalIndex === currentStep))
                          ?.key || "";

                  return phases.map((phase) => (
                    <div key={phase.key} className="phase-group">
                      <button
                        className={`phase-nav-item ${activePhaseKey === phase.key ? "active" : ""}`}
                        onClick={() => {
                          if (phase.key === "quiz") {
                            setCurrentStep(-2);
                          } else {
                            const idx = phase.steps[0]?.globalIndex ?? 0;
                            setCurrentStep(Math.max(0, Math.min(idx, pathResult.path.length - 1)));
                          }
                        }}
                      >
                        {phase.label}
                      </button>
                      {/* Substep list — only for non-quiz phases with multiple steps */}
                      {phase.key !== "quiz" && phase.steps.length > 0 && (
                        <ul className="substep-list">
                          {phase.steps.map((substep, i) => {
                            const step = pathResult.path[substep.globalIndex];
                            const rawTitle =
                              step?.segment?.title || step?.segment?.videoTitle || `Step ${i + 1}`;
                            // Decode HTML entities & truncate
                            const title = rawTitle
                              .replace(/&amp;/g, "&")
                              .replace(/&lt;/g, "<")
                              .replace(/&gt;/g, ">")
                              .replace(/&quot;/g, '"')
                              .replace(/&#39;/g, "'");
                            const shortTitle =
                              title.length > 35 ? title.substring(0, 33) + "…" : title;
                            return (
                              <li key={substep.globalIndex}>
                                <button
                                  className={`substep-item ${currentStep === substep.globalIndex ? "active" : ""}`}
                                  onClick={() => setCurrentStep(substep.globalIndex)}
                                  title={title}
                                >
                                  {i + 1}. {shortTitle}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ));
                })()}
              </nav>
            </aside>

            {/* Main Content Area */}
            <main className="epic-main-content">
              <div className="main-scroll-area">
                {currentStep === -2 ? (
                  <div className="quiz-phase-container">
                    <div className="step-article">
                      <h1>Knowledge Check</h1>
                      <p>Test your understanding of the concepts covered in this path.</p>

                      {(() => {
                        const fixStepIdx = pathResult.path.findIndex((s) => s.category === "fix");
                        const quizIdx = fixStepIdx >= 0 ? fixStepIdx : 0;

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
                ) : currentStep >= 0 && currentStep < pathResult.path.length ? (
                  <div className="step-content-container">
                    <PathStep
                      step={pathResult.path[currentStep]}
                      isActive={true}
                      narrationScript={narrationData?.get(currentStep)?.script}
                      stepAudioUrl={
                        narrationData?.get(currentStep)?.audioUrl || stepAudios.get(currentStep)
                      }
                      stepAudioLoading={stepAudioLoading === currentStep}
                      onGenerateAudio={() => handleStepAudio(currentStep)}
                      narrationLoading={narrationLoading}
                      onGenerateNarration={handleGenerateNarration}
                      hasNarration={!!narrationData}
                      takeaways={stepTakeaways.get(currentStep)}
                      takeawayLoading={takeawayLoading === currentStep}
                    />
                  </div>
                ) : null}
              </div>

              {/* Footer Navigation */}
              <footer className="epic-footer">
                <button
                  className="nav-btn"
                  onClick={() => {
                    if (currentStep === -2) {
                      // From quiz, go back to last step
                      setCurrentStep(pathResult.path.length - 1);
                    } else if (currentStep > 0) {
                      setCurrentStep(currentStep - 1);
                    }
                  }}
                  disabled={currentStep <= 0 && currentStep !== -2}
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <div className="footer-status">
                  {currentStep === -2
                    ? "Quiz"
                    : `Step ${Math.min(currentStep + 1, pathResult.path.length)} of ${pathResult.path.length}`}
                </div>
                <button
                  className="nav-btn"
                  onClick={() => {
                    if (currentStep < pathResult.path.length - 1) {
                      setCurrentStep(currentStep + 1);
                    } else if (currentStep === pathResult.path.length - 1) {
                      setCurrentStep(-2); // Go to quiz
                    }
                  }}
                  disabled={currentStep === -2}
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </footer>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
