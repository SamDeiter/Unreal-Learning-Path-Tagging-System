/**
 * BespokePath — AI-generated "Fix a Problem" learning path UI
 *
 * Renders the full bespoke path experience:
 * 1. Query input → 2. Loading pipeline → 3. Sequenced path with bridge narrations
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "../../services/firebaseConfig";
import { generateBespokePath } from "../../services/bespokePathService";
import { generateQuizForStep } from "../../services/quizService";
import { findCachedPath, cachePath, addToHistory } from "../../services/pathCacheService";
import { sanitizeQuery, checkRateLimit, recordQuery } from "../../services/securityGuardrails";
import PRE_SEEDED_PATHS from "../../data/preSeededPaths";
import PathStep from "./PathStep";
import BridgeNarration from "./BridgeNarration";
import PathProgress from "./PathProgress";
import QuizEngine from "./QuizEngine";
import PreSeededPaths from "./PreSeededPaths";
import { generateStepAudio, generateStepTakeaways } from "../../services/stepBriefingService";
import "./BespokePath.css";

// Analytics & Token Tracking
import {
  startSession,
  trackEvent,
  trackQuerySubmitted,
  trackFollowupQuery,
  EVENTS,
} from "../../services/analyticsService";
import { recordTokenUsage } from "../../services/tokenTracker";

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
  { key: "problem",  icon: "📋", label: "THE PROBLEM",  categories: ["foundation", "diagnosis"] },
  { key: "solution", icon: "🔧", label: "THE SOLUTION", categories: ["fix"] },
  { key: "quiz",     icon: "📝", label: "QUIZ",         categories: ["__quiz__"] },
  { key: "apply",    icon: "🚀", label: "APPLY IT",     categories: ["transfer"] },
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

  // Audio briefing state
  const [briefingAudioUrl, setBriefingAudioUrl] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingStatus, setBriefingStatus] = useState("");
  const audioRef = useRef(null);

  // Per-step audio and takeaways state
  const [stepAudios, setStepAudios] = useState(new Map());
  const [stepAudioLoading, setStepAudioLoading] = useState(null);
  const [stepTakeaways, setStepTakeaways] = useState(new Map());
  const [takeawayLoading, setTakeawayLoading] = useState(null);
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
    setCurrentStep(0);
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
    setIsLoading(false);
    setPipelineStage("");
  }, [query, isLoading]);

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
      handleLoadTakeaways(currentStep);
    }
  }, [currentStep, pathResult, handleLoadTakeaways]);

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

      {/* Path Results */}
      {pathResult && !pathResult.error && pathResult.path.length > 0 && (
        <div className="bespoke-results">
          {/* Epic-style Split Stepper Layout */}
          <div className="epic-stepper-layout">
            {/* Left Sidebar: Phased Navigation */}
            <div className="epic-sidebar">
              <h3 className="sidebar-title">Path Overview</h3>
              <p className="sidebar-query">
                <em>"{pathResult.query || query}"</em>
              </p>

              <div className="epic-step-list">
                {/* Audio Briefing entry */}
                {!pathResult.isPreSeeded && (
                  <div
                    className={`epic-step-item ${currentStep === -1 ? "active" : ""}`}
                    onClick={() => setCurrentStep(-1)}
                  >
                    <div className="epic-step-indicator">
                      <span className="step-dot">🎧</span>
                    </div>
                    <div className="epic-step-info">
                      <strong className="epic-step-category">Overview</strong>
                      <span className="epic-step-title">Listen to Briefing</span>
                    </div>
                  </div>
                )}

                {/* Phased step groups */}
                {groupStepsIntoPhases(pathResult.path).map((phase) => (
                  <div key={phase.key} className="phase-group">
                    <div className={`phase-label phase-${phase.key}`}>
                      <span className="phase-icon">{phase.icon}</span>
                      <span className="phase-text">{phase.label}</span>
                      {phase.key === "quiz" && quizScores.size > 0 && (
                        <span className="phase-score">
                          {[...quizScores.values()].reduce((s, q) => s + q.score, 0)}/
                          {[...quizScores.values()].reduce((s, q) => s + q.total, 0)} ✓
                        </span>
                      )}
                    </div>

                    {phase.steps.map((step) => {
                      if (step.category === "__quiz__") {
                        return (
                          <div
                            key="quiz-phase"
                            className={`epic-step-item ${currentStep === -2 ? "active" : ""} ${quizScores.size > 0 ? "completed" : ""}`}
                            onClick={() => setCurrentStep(-2)}
                          >
                            <div className="epic-step-indicator">
                              <span className="step-dot">{quizScores.size > 0 ? "✓" : "📝"}</span>
                            </div>
                            <div className="epic-step-info">
                              <span className="epic-step-title">Knowledge Check</span>
                            </div>
                          </div>
                        );
                      }

                      const isActive = step.globalIndex === currentStep;
                      const isCompleted = step.globalIndex < currentStep && currentStep >= 0;
                      return (
                        <div
                          key={step.globalIndex}
                          className={`epic-step-item ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                          onClick={() => setCurrentStep(step.globalIndex)}
                        >
                          <div className="epic-step-indicator">
                            <span className="step-dot">{isCompleted ? "✓" : step.globalIndex + 1}</span>
                          </div>
                          <div className="epic-step-info">
                            <span className="epic-step-title">
                              {step.summary || step.segment?.title || "Step Details"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Final Score Summary in Sidebar */}
              {quizScores.size > 0 && (
                <div className="sidebar-score-summary">
                  <span className="score-icon">🏆</span>
                  <div>
                    Score:
                    <br />
                    <strong>
                      {[...quizScores.values()].reduce((s, q) => s + q.score, 0)}/
                      {[...quizScores.values()].reduce((s, q) => s + q.total, 0)}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* Right Main Content Area: Active Step */}
            <div className="epic-main-content">
              {/* Show Audio Briefing if selected */}
              {currentStep === -1 && !pathResult.isPreSeeded && (
                <div className="audio-briefing-section top-briefing">
                  <h3 className="section-title">Overview Audio Briefing</h3>
                  <p className="section-desc">
                    Get a high-level summary of the solution before diving into the steps.
                  </p>

                  {briefingAudioUrl ? (
                    <div className="audio-player-wrapper">
                      <audio ref={audioRef} controls src={briefingAudioUrl} />
                    </div>
                  ) : (
                    <div className="briefing-gen-area">
                      <button
                        className="briefing-btn epic-primary-btn"
                        disabled={briefingLoading}
                        onClick={async () => {
                          setBriefingLoading(true);
                          setBriefingStatus("Generating script…");
                          try {
                            const app = getFirebaseApp();
                            const functions = getFunctions(app, "us-central1");
                            const genFn = httpsCallable(functions, "generateAudioBriefing", {
                              timeout: 120000,
                            });
                            setBriefingStatus("Synthesizing audio (this may take 30-60s)…");
                            const result = await genFn({
                              query: pathResult.query || query,
                              steps: pathResult.path.map((s) => ({
                                category: s.category,
                                summary: s.summary || s.segment?.title || "",
                                title: s.segment?.title || s.segment?.videoTitle || "",
                              })),
                            });
                            if (result.data?.audio) {
                              const binary = atob(result.data.audio);
                              const bytes = new Uint8Array(binary.length);
                              for (let i = 0; i < binary.length; i++)
                                bytes[i] = binary.charCodeAt(i);
                              const blob = new Blob([bytes], { type: "audio/wav" });
                              setBriefingAudioUrl(URL.createObjectURL(blob));
                              setBriefingStatus("");

                              trackEvent("audio_briefing_generated", {
                                query: pathResult.query?.substring(0, 100),
                                step_count: pathResult.path?.length || 0,
                              });

                              // Track Token Usage
                              if (result.data?.tokenUsage) {
                                recordTokenUsage(
                                  "audioBriefing",
                                  result.data.tokenUsage.inputTokens || 0,
                                  result.data.tokenUsage.outputTokens || 0
                                );
                              }
                            } else {
                              setBriefingStatus("Error: No audio data returned");
                            }
                          } catch (err) {
                            console.error("Audio briefing error:", err);
                            setBriefingStatus(`Error: ${err.message}`);
                          } finally {
                            setBriefingLoading(false);
                          }
                        }}
                      >
                        {briefingLoading ? "⏳ Generating Audio..." : "🎧 Listen to Briefing"}
                      </button>
                      {briefingStatus && <p className="briefing-status">{briefingStatus}</p>}
                    </div>
                  )}

                  <div className="epic-step-navigation">
                    <button className="epic-nav-btn next-btn" onClick={() => setCurrentStep(0)}>
                      Start First Step →
                    </button>
                  </div>
                </div>
              )}

              {/* Show Active Step Content */}
              {currentStep >= 0 && currentStep < pathResult.path.length && (
                <div className="active-step-container">
                  {/* Optional: Show bridge narration if arriving from previous step */}
                  {currentStep > 0 && pathResult.bridges && (
                    <BridgeNarration
                      bridge={pathResult.bridges.find(
                        (b) => b.from === currentStep - 1 && b.to === currentStep
                      )}
                      fromCategory={pathResult.path[currentStep - 1].category}
                      toCategory={pathResult.path[currentStep].category}
                    />
                  )}

                  <PathStep
                    step={pathResult.path[currentStep]}
                    index={currentStep}
                    isActive={true} /* Force true since it's only rendered when active */
                    onClick={() => {}}
                    stepAudioUrl={stepAudios.get(currentStep)}
                    stepAudioLoading={stepAudioLoading === currentStep}
                    onGenerateAudio={() => handleStepAudio(currentStep)}
                    takeaways={stepTakeaways.get(currentStep)}
                    takeawayLoading={takeawayLoading === currentStep}
                  />

                  {/* Quiz Area */}
                  <div className="step-quiz-area">
                    {showQuiz === currentStep && quizzes.has(currentStep) ? (
                      <QuizEngine
                        questions={quizzes.get(currentStep)}
                        stepIndex={currentStep}
                        onComplete={handleQuizComplete}
                      />
                    ) : quizScores.has(currentStep) ? (
                      <div className="quiz-score-badge">
                        ✅ Quiz: {quizScores.get(currentStep).score}/
                        {quizScores.get(currentStep).total}
                      </div>
                    ) : (
                      <button
                        className="take-quiz-btn epic-secondary-btn"
                        onClick={() => handleTakeQuiz(currentStep)}
                        disabled={quizLoading === currentStep}
                      >
                        {quizLoading === currentStep
                          ? "Generating quiz..."
                          : "📝 Take Quiz on This Step"}
                      </button>
                    )}
                  </div>

                  {/* Phase-Aware Navigation Buttons */}
                  <div className="epic-step-navigation">
                    <button
                      className="epic-nav-btn prev-btn"
                      onClick={() => {
                        if (currentStep === 0 && !pathResult.isPreSeeded) {
                          setCurrentStep(-1); // Back to overview
                        } else if (currentStep > 0) {
                          setCurrentStep(currentStep - 1);
                        }
                      }}
                      disabled={currentStep === 0 && pathResult.isPreSeeded}
                    >
                      {currentStep === 0 ? "← Back to Overview" : `← Previous`}
                    </button>

                    {(() => {
                      const phases = groupStepsIntoPhases(pathResult.path);
                      const currentPhase = phases.find((p) =>
                        p.steps.some((s) => s.globalIndex === currentStep)
                      );
                      const currentPhaseIdx = phases.indexOf(currentPhase);
                      const nextPhase = phases[currentPhaseIdx + 1];
                      const isLastInPhase =
                        currentPhase &&
                        currentStep === currentPhase.steps[currentPhase.steps.length - 1]?.globalIndex;
                      const isLastStep = currentStep === pathResult.path.length - 1;

                      if (isLastStep && !nextPhase) {
                        return (
                          <button
                            className="epic-nav-btn complete-btn"
                            onClick={() => window.scrollTo(0, 0)}
                          >
                            Complete Path ✓
                          </button>
                        );
                      }

                      if (isLastInPhase && nextPhase && nextPhase.key === "quiz") {
                        return (
                          <button
                            className="epic-nav-btn next-btn"
                            onClick={() => setCurrentStep(-2)}
                          >
                            Continue to Quiz →
                          </button>
                        );
                      }

                      if (isLastInPhase && nextPhase) {
                        return (
                          <button
                            className="epic-nav-btn next-btn"
                            onClick={() => setCurrentStep(nextPhase.steps[0]?.globalIndex ?? currentStep + 1)}
                          >
                            {nextPhase.icon} Continue to {nextPhase.label} →
                          </button>
                        );
                      }

                      return (
                        <button
                          className="epic-nav-btn next-btn"
                          onClick={() => setCurrentStep(currentStep + 1)}
                        >
                          Next Step →
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Quiz Phase View (currentStep === -2) */}
              {currentStep === -2 && (
                <div className="active-step-container quiz-phase-container">
                  <div className="phase-header">
                    <span className="phase-header-icon">📝</span>
                    <h3>Knowledge Check</h3>
                    <p className="phase-header-desc">
                      Test your understanding of the concepts covered in this path.
                    </p>
                  </div>

                  {/* Generate quiz from all fix steps */}
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
                        className="take-quiz-btn epic-secondary-btn"
                        onClick={() => handleTakeQuiz(quizIdx)}
                        disabled={quizLoading === quizIdx}
                      >
                        {quizLoading === quizIdx ? "Generating quiz..." : "📝 Start Quiz"}
                      </button>
                    );
                  })()}

                  <div className="epic-step-navigation">
                    <button
                      className="epic-nav-btn prev-btn"
                      onClick={() => {
                        const lastFixIdx = [...pathResult.path.keys()]
                          .reverse()
                          .find((i) => pathResult.path[i].category === "fix");
                        setCurrentStep(lastFixIdx ?? 0);
                      }}
                    >
                      ← Back to Solutions
                    </button>
                    {pathResult.path.some((s) => s.category === "transfer") && (
                      <button
                        className="epic-nav-btn next-btn"
                        onClick={() => {
                          const firstTransferIdx = pathResult.path.findIndex(
                            (s) => s.category === "transfer"
                          );
                          setCurrentStep(firstTransferIdx);
                        }}
                      >
                        🚀 Continue to Apply It →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className="bespoke-meta">
            <span>
              {pathResult.path.length} steps • {pathResult.segments.length} sources searched •{" "}
              Generated {new Date(pathResult.generatedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
