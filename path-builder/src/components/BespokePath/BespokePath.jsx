/**
 * BespokePath — AI-generated "Fix a Problem" learning path UI
 *
 * Renders the full bespoke path experience:
 * 1. Query input → 2. Loading pipeline → 3. Sequenced path with bridge narrations
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { generateBespokePath } from "../../services/bespokePathService";
import usePathQuiz from "../../hooks/usePathQuiz";
import usePathStepActions from "../../hooks/usePathStepActions";
import { findCachedPath, cachePath, addToHistory } from "../../services/pathCacheService";
import { sanitizeQuery, checkRateLimit, recordQuery } from "../../services/securityGuardrails";
import PRE_SEEDED_PATHS from "../../data/preSeededPaths";
import SUGGESTION_POOL, { DEFAULT_SUGGESTIONS } from "../../data/suggestionPool";
import PathStep from "./PathStep";
import QuizEngine from "./QuizEngine";
import PreSeededPaths from "./PreSeededPaths";
import PathGapCard from "./PathGapCard";
import PathWizard from "./PathWizard";
import PathDiff from "./PathDiff";
import PrereqChain from "./PrereqChain";
import {
  generateGapFillStep,
  generateBespokeGapStep,
  buildPrereqChain,
} from "../../services/pathGapAnalyzer";
import { insertAtPhasePosition } from "../../utils/insertAtPhasePosition";
import { getStruggleBadges } from "../../services/struggleBadgeService";
import { generatePathNarration } from "../../services/stepBriefingService";
import "./BespokePath.css";

import {
  startSession,
  trackEvent,
  trackQuerySubmitted,
  trackFollowupQuery,
  EVENTS,
} from "../../services/analyticsService";

// ── Phase Grouping ──────────────────────────────────────
// Maps step categories to the 4-phase pedagogical flow
const PHASE_CONFIG = [
  { key: "problem", icon: "📋", label: "Questions", categories: ["foundation", "diagnosis"] },
  { key: "solution", icon: "🔧", label: "Solution", categories: ["fix"] },
  { key: "quiz", icon: "📝", label: "Quiz", categories: ["__quiz__"] },
  { key: "apply", icon: "🚀", label: "Apply It", categories: ["transfer"] },
  { key: "review", icon: "✅", label: "Review", categories: ["__review__"] },
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

  // Review phase: virtual
  phases.push({ ...PHASE_CONFIG[4], steps: [{ category: "__review__", globalIndex: -3 }] });

  return phases;
}

export default function BespokePath() {
  const [query, setQuery] = useState("");
  const [pathResult, setPathResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [pipelineStage, setPipelineStage] = useState("");
  const [inputError, setInputError] = useState("");

  // Quiz state (shared hook)
  const {
    quizzes,
    quizLoading,
    quizScores,
    showQuiz,
    handleTakeQuiz,
    handleQuizComplete,
    resetQuiz,
  } = usePathQuiz({ pathData: pathResult, query });

  // Per-step audio, takeaways (shared hook)
  const { stepAudio, stepTakeaways, handleStepAudio } = usePathStepActions({
    pathData: pathResult,
    query,
    activeStep: currentStep,
  });

  // Path Narrator state (button-triggered, not auto)
  const [narrationData, setNarrationData] = useState(null);
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);

  // Phase 3 state
  const [originalSteps, setOriginalSteps] = useState(null); // Snapshot for PathDiff
  const [originalCoverage, setOriginalCoverage] = useState(0);
  const [prereqChain, setPrereqChain] = useState(null);
  const [struggleBadges, setStruggleBadges] = useState(new Map());
  const [reviewTab, setReviewTab] = useState("checklist"); // "checklist" | "diff" | "dependencies"
  const [fillResults, setFillResults] = useState({});

  const isFollowUp = useRef(false);

  // Start analytics session on mount
  useEffect(() => {
    startSession();
  }, []);

  // Phase 3: Fetch prereq chain and struggle badges when path changes
  useEffect(() => {
    if (!pathResult || !pathResult.path || pathResult.path.length === 0) return;

    // Build prereq chain (async)
    buildPrereqChain(pathResult.path).then((chain) => {
      setPrereqChain(chain);
    });

    // Fetch struggle badges (async, fire-and-forget)
    getStruggleBadges(pathResult.path).then((badges) => {
      setStruggleBadges(badges);
    });
  }, [pathResult]);

  // Gap fill callback — uses 3-tier waterfall, stores structured results
  const handleFillGap = useCallback(
    async (blind) => {
      if (!pathResult) return;
      const topic = typeof blind === "string" ? blind : blind.topic || blind;
      try {
        const existingCodes = pathResult.path.map((s) => s.segment?.id || s.code).filter(Boolean);
        const result = await generateGapFillStep(
          topic,
          pathResult.query || query,
          pathResult.path,
          existingCodes
        );
        setFillResults((prev) => ({ ...prev, [topic]: result }));
      } catch (err) {
        console.warn("[BespokePath] Fill gap failed:", err.message);
        setFillResults((prev) => ({ ...prev, [topic]: { error: true } }));
      }
    },
    [pathResult, query]
  );

  // Add a library course match to the path
  const handleAddLibraryCourse = useCallback((courseMatch, topic) => {
    const newStep = {
      category: "fix",
      segment: {
        id: courseMatch.code,
        title: courseMatch.title,
        text: courseMatch.description || "",
        source: "library",
      },
    };
    setPathResult((prev) => ({
      ...prev,
      path: insertAtPhasePosition(prev.path, newStep),
    }));
    setFillResults((prev) => ({
      ...prev,
      [topic]: { ...prev[topic], addedCode: courseMatch.code },
    }));
  }, []);

  // Add a single video segment to the path
  const handleAddSegment = useCallback((segment, topic, segIndex) => {
    const newStep = {
      category: "fix",
      segment: {
        id: `bespoke-${topic}-${segIndex}`,
        title: segment.title || `${topic} Segment`,
        text: segment.text || "",
        source: segment.videoTitle || "bespoke",
      },
    };
    setPathResult((prev) => ({
      ...prev,
      path: insertAtPhasePosition(prev.path, newStep),
    }));
    setFillResults((prev) => ({
      ...prev,
      [topic]: {
        ...prev[topic],
        addedSegments: [...(prev[topic]?.addedSegments || []), segIndex],
      },
    }));
  }, []);

  // Generate a combined bespoke step from segments
  const handleBespokeGenerate = useCallback((segments, topic) => {
    const bespokeStep = generateBespokeGapStep(topic, segments);
    const wrappedStep = {
      category: "fix",
      segment: bespokeStep,
    };
    setPathResult((prev) => ({
      ...prev,
      path: insertAtPhasePosition(prev.path, wrappedStep),
    }));
    setFillResults((prev) => ({
      ...prev,
      [topic]: { ...prev[topic], bespokeGenerated: true },
    }));
  }, []);

  // Explore gap callback — opens search for the blind spot topic
  const handleExploreGap = useCallback((blind) => {
    const searchUrl = `https://www.google.com/search?q=site%3Adev.epicgames.com+unreal+engine+${encodeURIComponent(blind.topic || blind.title || "")}`;
    window.open(searchUrl, "_blank", "noopener,noreferrer");
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
    resetQuiz();

    // 1. Check cache first (zero cost)
    setPipelineStage("Checking cache...");
    const cached = await findCachedPath(trimmed);
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
    // Snapshot original steps for PathDiff
    if (result.path?.length > 0) {
      setOriginalSteps([...result.path]);
      setOriginalCoverage(result.gaps?.coverageScore || 0);
    }
    // Also reset quizzes and scores for new search
    resetQuiz();
  }, [query, isLoading, pathResult?.query, resetQuiz]);

  // Handle selecting a pre-seeded path (zero API cost)
  const handlePreSeededSelect = useCallback(
    (path) => {
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
      resetQuiz();
    },
    [resetQuiz]
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
          </div>
          <button
            className="bespoke-submit"
            onClick={handleGenerate}
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? <span className="bespoke-spinner" /> : "🚀 Generate Path"}
          </button>

          {/* Example queries */}
          {!pathResult && !isLoading && (
            <div className="bespoke-examples">
              <span className="examples-label">Suggested:</span>
              {DEFAULT_SUGGESTIONS.map((ex, i) => (
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
                      : currentStep === -3
                        ? "review"
                        : phases.find((p) => p.steps.some((s) => s.globalIndex === currentStep))
                            ?.key || "";

                  return phases.map((phase) => (
                    <div key={phase.key} className="phase-group">
                      <button
                        className={`phase-nav-item ${activePhaseKey === phase.key ? "active" : ""}`}
                        onClick={() => {
                          if (phase.key === "quiz") {
                            setCurrentStep(-2);
                          } else if (phase.key === "review") {
                            setCurrentStep(-3);
                          } else {
                            const idx = phase.steps[0]?.globalIndex ?? 0;
                            setCurrentStep(Math.max(0, Math.min(idx, pathResult.path.length - 1)));
                          }
                        }}
                      >
                        {phase.label}
                      </button>
                      {/* Substep list — only for non-quiz phases with multiple steps */}
                      {phase.key !== "quiz" && phase.key !== "review" && phase.steps.length > 0 && (
                        <ul className="substep-list">
                          {(() => {
                            // Pre-scan for duplicate titles within this phase
                            const titleCounts = {};
                            const titleOccurrence = {};
                            phase.steps.forEach((substep) => {
                              const step = pathResult.path[substep.globalIndex];
                              const rawT = step?.segment?.title || step?.segment?.videoTitle || "";
                              titleCounts[rawT] = (titleCounts[rawT] || 0) + 1;
                            });

                            return phase.steps.map((substep, i) => {
                              const step = pathResult.path[substep.globalIndex];
                              let rawTitle =
                                step?.segment?.title ||
                                step?.segment?.videoTitle ||
                                `Step ${i + 1}`;

                              // Append "Part N" for duplicates
                              if (titleCounts[rawTitle] > 1) {
                                titleOccurrence[rawTitle] = (titleOccurrence[rawTitle] || 0) + 1;
                                rawTitle = `${rawTitle} (Part ${titleOccurrence[rawTitle]})`;
                              }

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
                            });
                          })()}
                        </ul>
                      )}
                    </div>
                  ));
                })()}
              </nav>

              {/* Gap Analysis Card — below nav */}
              <PathGapCard
                gaps={pathResult.gaps}
                communityPainPoints={pathResult.communityPainPoints}
                query={pathResult.query || query}
                steps={pathResult.path}
                onFillGap={handleFillGap}
                onExplore={handleExploreGap}
                fillResults={fillResults}
                onAddCourse={handleAddLibraryCourse}
                onAddSegment={handleAddSegment}
                onGenerateBespoke={handleBespokeGenerate}
              />
            </aside>

            {/* Main Content Area */}
            <main className="epic-main-content">
              <div className="main-scroll-area">
                {currentStep === -3 ? (
                  /* Review Phase — Tabbed view: Checklist / Diff / Dependencies */
                  <div className="step-content-container">
                    <div className="review-tabs">
                      <button
                        className={`review-tab-btn ${reviewTab === "checklist" ? "active" : ""}`}
                        onClick={() => setReviewTab("checklist")}
                      >
                        ✅ Checklist
                      </button>
                      <button
                        className={`review-tab-btn ${reviewTab === "diff" ? "active" : ""}`}
                        onClick={() => setReviewTab("diff")}
                      >
                        📊 Path Changes
                      </button>
                      <button
                        className={`review-tab-btn ${reviewTab === "dependencies" ? "active" : ""}`}
                        onClick={() => setReviewTab("dependencies")}
                      >
                        🔗 Dependencies
                      </button>
                    </div>
                    {reviewTab === "checklist" && (
                      <PathWizard pathResult={pathResult} gaps={pathResult.gaps} />
                    )}
                    {reviewTab === "diff" && (
                      <PathDiff
                        originalSteps={originalSteps || pathResult.path}
                        currentSteps={pathResult.path}
                        originalCoverage={originalCoverage}
                        currentCoverage={pathResult.gaps?.coverageScore || 0}
                      />
                    )}
                    {reviewTab === "dependencies" && <PrereqChain chain={prereqChain} />}
                  </div>
                ) : currentStep === -2 ? (
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
                      key={`step-${currentStep}`}
                      step={pathResult.path[currentStep]}
                      isActive={true}
                      narrationScript={narrationData?.get(currentStep)?.script}
                      stepAudioUrl={
                        narrationData?.get(currentStep)?.audioUrl || stepAudio[currentStep]?.url
                      }
                      stepAudioLoading={!!stepAudio[currentStep]?.loading}
                      onGenerateAudio={() =>
                        handleStepAudio(currentStep, pathResult.path[currentStep])
                      }
                      narrationLoading={narrationLoading}
                      onGenerateNarration={handleGenerateNarration}
                      hasNarration={!!narrationData}
                      autoPlayAudio={autoPlayAudio}
                      onAudioEnded={() => {
                        // Auto-advance to next phase when audio ends
                        if (!narrationData) return;
                        const currentPhase = narrationData.get(currentStep)?.phase;
                        // Find next step in a DIFFERENT phase
                        for (let i = currentStep + 1; i < pathResult.path.length; i++) {
                          const nextPhase = narrationData.get(i)?.phase;
                          if (nextPhase && nextPhase !== currentPhase) {
                            setAutoPlayAudio(true);
                            setCurrentStep(i);
                            return;
                          }
                        }
                        setAutoPlayAudio(false);
                      }}
                      takeaways={stepTakeaways[currentStep]?.items}
                      takeawayLoading={!!stepTakeaways[currentStep]?.loading}
                      query={pathResult?.query || query}
                      struggleBadge={struggleBadges.get(
                        pathResult.path[currentStep]?.segment?.title ||
                          pathResult.path[currentStep]?.segment?.videoTitle ||
                          pathResult.path[currentStep]?.title ||
                          ""
                      )}
                    />
                  </div>
                ) : null}
              </div>

              {/* Footer Navigation */}
              <footer className="epic-footer">
                <button
                  className="nav-btn"
                  onClick={() => {
                    if (currentStep === -3) {
                      setCurrentStep(-2); // Review → Quiz
                    } else if (currentStep === -2) {
                      setCurrentStep(pathResult.path.length - 1);
                    } else if (currentStep > 0) {
                      setCurrentStep(currentStep - 1);
                    }
                  }}
                  disabled={currentStep <= 0 && currentStep !== -2 && currentStep !== -3}
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <div className="footer-status">
                  {currentStep === -3
                    ? "Review"
                    : currentStep === -2
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
                    } else if (currentStep === -2) {
                      setCurrentStep(-3); // Go to review
                    }
                  }}
                  disabled={currentStep === -3}
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
