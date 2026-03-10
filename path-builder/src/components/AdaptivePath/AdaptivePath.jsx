/**
 * AdaptivePath — Diagnostic quiz + depth-adjusted learning path
 * Recent queries stored in localStorage (privacy: never leaves browser)
 *
 * Flow: INPUT → DIAGNOSING → PROFILE_READY → PATH_READY
 *
 * 1. User types a question
 * 2. Diagnostic quiz (3-5 narrowing questions) assesses knowledge
 * 3. Knowledge profile shows what they know vs gaps
 * 4. Generate a depth-adjusted BespokePath based on the profile
 */

import { useState, useEffect, useCallback } from "react";
import useAdaptiveQuiz from "../../hooks/useAdaptiveQuiz";
import usePathQuiz from "../../hooks/usePathQuiz";
import usePathStepActions from "../../hooks/usePathStepActions";
import { sanitizeQuery, checkRateLimit, recordQuery } from "../../services/securityGuardrails";
import { generateBespokePath } from "../../services/bespokePathService";
import { findCachedPath, cachePath } from "../../services/pathCacheService";
import { trackSessionCompleted } from "../../services/analyticsService";
import PathStep from "../BespokePath/PathStep";
import QuizEngine from "../BespokePath/QuizEngine";
import PathGapCard from "../BespokePath/PathGapCard";
import PathWizard from "../BespokePath/PathWizard";
import PathDiff from "../BespokePath/PathDiff";
import PrereqChain from "../BespokePath/PrereqChain";
import { generateGapFillStep, generateBespokeGapStep, buildPrereqChain } from "../../services/pathGapAnalyzer";
import { insertAtPhasePosition } from "../../utils/insertAtPhasePosition";
import { getStruggleBadges } from "../../services/struggleBadgeService";

import { cleanVideoTitle } from "../../utils/cleanVideoTitle";
import { loadRecentQueries, saveRecentQuery } from "../../utils/recentQueriesStore";
import { fixEpicUrl } from "../../utils/urlHelpers";
import PRE_SEEDED_PATHS from "../../data/preSeededPaths";
import PreSeededPaths from "../BespokePath/PreSeededPaths";
import "../BespokePath/BespokePath.css";
import "./AdaptivePath.css";
import LevelPicker from "./LevelPicker";

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
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  // Step expansion
  const [expandedStep, setExpandedStep] = useState(null);
  const [pipelineStep, setPipelineStep] = useState(0);

  // Voice selector
  const [voiceName, setVoiceName] = useState("Kore");

  const [recentQueries, setRecentQueries] = useState([]);

  // Load recent queries on mount
  useEffect(() => {
    setRecentQueries(loadRecentQueries());
  }, []);

  // Phase 3 state
  const [originalSteps, setOriginalSteps] = useState(null);
  const [originalCoverage, setOriginalCoverage] = useState(0);
  const [prereqChain, setPrereqChain] = useState(null);
  const [struggleBadges, setStruggleBadges] = useState(new Map());
  const [reviewTab, setReviewTab] = useState("checklist");

  const { knowledgeProfile, hasSavedProfile, clearProfile, setProfileDirect, STAGES } =
    useAdaptiveQuiz();

  // Shared hooks for step actions + quiz
  const {
    stepAudio,
    stepTakeaways,
    stepDeepDives,
    handleStepAudio,
    handleGoDeeper,
    resetStepActions,
  } = usePathStepActions({
    pathData: pathData,
    query,
    voiceName,
    userLevel: knowledgeProfile?.level || "intermediate",
    activeStep: expandedStep,
  });

  const {
    quizzes,
    quizLoading,
    quizScores,
    showQuiz,
    handleTakeQuiz,
    handleQuizComplete,
    resetQuiz,
  } = usePathQuiz({
    pathData: pathData,
    query,
    onComplete: ({ stepIndex, score, total }) => {
      // Track path completion when the end-of-path quiz finishes
      if (stepIndex === -2) {
        trackSessionCompleted("adaptive-path", {
          query: pathData?.query || query,
          stepsCompleted: pathData?.path?.length || 0,
          quizScore: score,
          quizTotal: total,
          knowledgeLevel: knowledgeProfile?.level || "unknown",
        });
      }
    },
  });

  /**
   * Handle starting path generation
   */
  const [pendingGeneration, setPendingGeneration] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [pendingCleanedQuery, setPendingCleanedQuery] = useState("");

  const handleStart = useCallback(async () => {
    const result = sanitizeQuery(query);
    if (!result.valid) return;

    const cleaned = result.sanitized;
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) return;

    recordQuery(cleaned);
    saveRecentQuery(cleaned);
    setRecentQueries(loadRecentQueries());

    // Skip level picker if we already have a learner profile (saved within 24hr)
    if (knowledgeProfile) {
      setQuery(cleaned);
      setPendingGeneration(true);
      return;
    }

    // Show the simple level picker instead of running a full diagnostic quiz
    setPendingCleanedQuery(cleaned);
    setShowLevelPicker(true);
  }, [query, knowledgeProfile]);

  /**
   * Handle level selection from the simple picker
   */
  const handleLevelSelect = useCallback(
    (level) => {
      const profile = { level, knows: [], gaps: [] };
      setProfileDirect(profile);
      setQuery(pendingCleanedQuery);
      setShowLevelPicker(false);
      setPendingGeneration(true);
    },
    [pendingCleanedQuery, setProfileDirect]
  );

  /**
   * Handle selecting a pre-seeded path (skip diagnostic, instantly show path)
   */
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
        text: "",
      })),
      segments: path.steps,
      generatedAt: new Date().toISOString(),
      isPreSeeded: true,
    };
    setQuery(path.query);
    setPathData(fakeResult);
    setExpandedStep(0);
  }, []);

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
      // Check cache first (exact match by query + level + gaps)
      const gapsKey =
        knowledgeProfile.gaps?.length > 0
          ? `_gaps_${[...knowledgeProfile.gaps].sort().join(",")}`
          : "";
      const profileKey = `${query}_adaptive_${knowledgeProfile.level}${gapsKey}`;
      const cached = await findCachedPath(profileKey, 1.0);
      if (cached) {
        timers.forEach(clearTimeout);
        setPathData(cached);
        setExpandedStep(0);
        setIsAiGenerated(!!cached.isAiGenerated);
        setPathLoading(false);
        return;
      }

      // Generate path with knowledge profile context
      const result = await generateBespokePath(query, knowledgeProfile);

      if (result.error) {
        setPathError(result.error);
      } else {
        setPathData(result);
        setExpandedStep(0);
        setIsAiGenerated(!!result.isAiGenerated);
        cachePath(profileKey, result);
      }
    } catch (err) {
      setPathError(err.message || "Failed to generate learning path.");
    } finally {
      timers.forEach(clearTimeout);
      setPathLoading(false);
    }
  }, [query, knowledgeProfile]);

  // Auto-generate path when skipping diagnostic (saved profile)
  useEffect(() => {
    if (pendingGeneration && query && knowledgeProfile && !pathLoading) {
      setPendingGeneration(false);
      handleGeneratePath();
    }
  }, [pendingGeneration, query, knowledgeProfile, pathLoading, handleGeneratePath]);

  // Phase 3: Fetch prereq chain and struggle badges when path changes
  useEffect(() => {
    if (!pathData || !pathData.path || pathData.path.length === 0) return;

    // Snapshot original steps for PathDiff (only on first load)
    if (!originalSteps) {
      setOriginalSteps([...pathData.path]);
      setOriginalCoverage(pathData.gaps?.coverageScore || 0);
    }

    buildPrereqChain(pathData.path).then((chain) => {
      setPrereqChain(chain);
    });

    getStruggleBadges(pathData.path).then((badges) => {
      setStruggleBadges(badges);
    });
  }, [pathData]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Start over completely
   */
  const handleReset = useCallback(() => {
    clearProfile();
    setShowLevelPicker(false);
    setPendingCleanedQuery("");
    setQuery("");
    setPathData(null);
    setPathError(null);
    setPathLoading(false);
    setExpandedStep(null);
    resetStepActions();
    resetQuiz();
  }, [clearProfile, resetStepActions, resetQuiz]);

  // Auto-advance to next step when audio finishes playing
  const handleAudioEnded = useCallback(() => {
    const cur = expandedStep ?? 0;
    const total = pathData?.path?.length ?? 0;
    if (cur < total - 1) {
      setExpandedStep(cur + 1);
    }
  }, [expandedStep, pathData]);

  // 3-tier gap fill state
  const [fillResults, setFillResults] = useState({});

  // Gap fill callback — uses 3-tier waterfall, stores structured results
  const handleFillGap = useCallback(
    async (topic) => {
      if (!pathData) return;
      const topicStr = typeof topic === "string" ? topic : topic.topic || topic;
      try {
        const existingCodes = pathData.path
          .map((s) => s.segment?.id || s.code)
          .filter(Boolean);
        const result = await generateGapFillStep(
          topicStr, pathData.query || query, pathData.path, existingCodes
        );
        setFillResults((prev) => ({ ...prev, [topicStr]: result }));
      } catch (err) {
        console.warn("[AdaptivePath] Fill gap failed:", err.message);
        setFillResults((prev) => ({ ...prev, [topicStr]: { error: true } }));
      }
    },
    [pathData, query]
  );

  // Add a library course match to the path
  const handleAddLibraryCourse = useCallback(
    (courseMatch, topic) => {
      const newStep = {
        category: "fix",
        segment: {
          id: courseMatch.code,
          title: courseMatch.title,
          text: courseMatch.description || "",
          source: "library",
        },
      };
      setPathData((prev) => ({
        ...prev,
        path: insertAtPhasePosition(prev.path, newStep),
      }));
      setFillResults((prev) => ({
        ...prev,
        [topic]: { ...prev[topic], addedCode: courseMatch.code },
      }));
    },
    []
  );

  // Add a single video segment to the path
  const handleAddSegment = useCallback(
    (segment, topic, segIndex) => {
      const newStep = {
        category: "fix",
        segment: {
          id: `bespoke-${topic}-${segIndex}`,
          title: segment.title || `${topic} Segment`,
          text: segment.text || "",
          source: segment.videoTitle || "bespoke",
        },
      };
      setPathData((prev) => ({
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
    },
    []
  );

  // Generate a combined bespoke step from segments
  const handleBespokeGenerate = useCallback(
    (segments, topic) => {
      const bespokeStep = generateBespokeGapStep(topic, segments);
      const wrappedStep = {
        category: "fix",
        segment: bespokeStep,
      };
      setPathData((prev) => ({
        ...prev,
        path: insertAtPhasePosition(prev.path, wrappedStep),
      }));
      setFillResults((prev) => ({
        ...prev,
        [topic]: { ...prev[topic], bespokeGenerated: true },
      }));
    },
    []
  );

  // Explore callback — resets and pre-fills query
  const handleExploreGap = useCallback(
    (topic) => {
      handleReset();
      setQuery(topic);
    },
    [handleReset]
  );

  // ── RENDER: Input Stage ──
  if (!showLevelPicker && !pathLoading && !pendingGeneration && !pathData) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-input-section">
          <h1 className="adaptive-title">🎯 Adaptive Learning Path</h1>
          <p className="adaptive-subtitle">
            Tell us what you want to learn about. We&apos;ll tailor a personalized path based on
            your experience level.
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

            {recentQueries.length > 0 && (
              <div className="recent-queries-section">
                <span className="recent-queries-label">🕐 Recent Questions:</span>
                <div className="recent-queries-grid">
                  {recentQueries.map((q, i) => (
                    <button key={i} className="recent-query-card" onClick={() => setQuery(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pre-seeded popular paths (skip diagnostic, instant results) */}
          <PreSeededPaths paths={PRE_SEEDED_PATHS} onSelect={handlePreSeededSelect} />
        </div>
      </div>
    );
  }

  // ── RENDER: Experience Level Picker (replaces diagnostic quiz) ──
  if (showLevelPicker) {
    return <LevelPicker onSelect={handleLevelSelect} />;
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
      {
        key: "prereq",
        icon: "📋",
        label: "Prerequisites",
        categories: ["prerequisite", "foundation", "diagnosis"],
      },
      { key: "core", icon: "🔧", label: "Core Steps", categories: ["core", "fix"] },
      { key: "practice", icon: "🚀", label: "Practice", categories: ["practice", "transfer"] },
      { key: "quiz", icon: "📝", label: "Quiz", categories: ["__quiz__"] },
      { key: "reading", icon: "📖", label: "Further Reading", categories: ["__reading__"] },
      { key: "review", icon: "✅", label: "Review", categories: ["__review__"] },
    ];

    const phases = [];
    for (const config of PHASE_CONFIG) {
      if (config.key === "quiz") {
        // Quiz is a virtual phase, always include it
        phases.push({ ...config, steps: [{ category: "__quiz__", globalIndex: -2 }] });
        continue;
      }
      if (config.key === "reading") {
        phases.push({ ...config, steps: [{ category: "__reading__", globalIndex: -3 }] });
        continue;
      }
      if (config.key === "review") {
        phases.push({ ...config, steps: [{ category: "__review__", globalIndex: -4 }] });
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
          : expandedStep === -4
            ? "review"
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
                {hasSavedProfile && (
                  <button
                    onClick={() => {
                      clearProfile();
                      setShowLevelPicker(true);
                      setPendingCleanedQuery(query);
                    }}
                    style={{
                      display: "block",
                      marginTop: "6px",
                      background: "transparent",
                      border: "none",
                      color: "#64748b",
                      fontSize: "0.6rem",
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    ⚙️ Change Experience Level
                  </button>
                )}
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
                        } else if (phase.key === "review") {
                          setExpandedStep(-4);
                        } else {
                          const idx = phase.steps[0]?.globalIndex ?? 0;
                          setExpandedStep(idx);
                        }
                      }}
                    >
                      {phase.label}
                    </button>
                    {/* Substep list — only for real content phases */}
                    {phase.key !== "quiz" &&
                      phase.key !== "reading" &&
                      phase.key !== "review" &&
                      phase.steps.length > 0 && (
                        <ul className="substep-list">
                          {phase.steps.map((substep, i) => {
                            const step = pathData.path[substep.globalIndex];
                            // Prefer the AI-generated step title, then segment title, then summary excerpt
                            let rawTitle =
                              step?.title ||
                              cleanVideoTitle(step?.segment?.title || step?.segment?.videoTitle) ||
                              (step?.summary
                                ? step.summary.split(".")[0].substring(0, 50)
                                : null) ||
                              `Part ${i + 1}`;
                            return (
                              <li key={substep.globalIndex}>
                                <button
                                  className={`substep-item ${(expandedStep ?? 0) === substep.globalIndex ? "active" : ""}`}
                                  onClick={() => setExpandedStep(substep.globalIndex)}
                                  title={rawTitle}
                                >
                                  {i + 1}. {rawTitle}
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

              {/* Gap Analysis Card removed — gaps are now auto-filled
                 into the path by the pipeline (Stage 3.5) */}
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

                {/* Low corpus coverage — encourage refinement */}
                {isAiGenerated && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "10px 16px",
                      fontSize: "0.75rem",
                      color: "#7dd3fc",
                      background: "rgba(125, 211, 252, 0.06)",
                      border: "1px solid rgba(125, 211, 252, 0.15)",
                      borderRadius: "8px",
                      margin: "0 0 16px 0",
                    }}
                  >
                    🎨 Custom AI-powered path created just for you!
                    <br />
                    <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>
                      💡 Tip: Adding UE5-specific terms (e.g. &quot;horse <em>character in UE5</em>
                      &quot;) can unlock even more tailored results.
                    </span>
                  </div>
                )}

                {expandedStep === -4 ? (
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
                      <PathWizard
                        pathResult={pathData}
                        gaps={pathData.gaps}
                        onFixClick={() => {
                          const gapCard = document.getElementById("gap-analysis-card");
                          if (gapCard) {
                            gapCard.scrollIntoView({ behavior: "smooth", block: "start" });
                            const toggleBtn = document.getElementById("gap-card-toggle-btn");
                            if (toggleBtn && toggleBtn.getAttribute("aria-expanded") === "false") {
                              toggleBtn.click();
                            }
                          }
                        }}
                      />
                    )}
                    {reviewTab === "diff" && (
                      <PathDiff
                        originalSteps={originalSteps || pathData.path}
                        currentSteps={pathData.path}
                        originalCoverage={originalCoverage}
                        currentCoverage={pathData.gaps?.coverageScore || 0}
                      />
                    )}
                    {reviewTab === "dependencies" && <PrereqChain chain={prereqChain} />}
                  </div>
                ) : expandedStep === -2 ? (
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
                          const isAiGenerated =
                            step.segment?.type === "ai_generated" ||
                            step.segment?.source === "ai_generated";
                          const url = isAiGenerated
                            ? null
                            : fixEpicUrl(step.segment?.videoUrl || step.segment?.url);
                          const title =
                            cleanVideoTitle(step.segment?.title || step.segment?.videoTitle) ||
                            `Step ${i + 1}`;
                          const sourceType = isAiGenerated
                            ? "ai_generated"
                            : step.segment?.type || step.segment?.source || "docs";
                          const icon = isAiGenerated
                            ? "fa-robot"
                            : sourceType === "transcript"
                              ? "fa-video"
                              : "fa-book-open";
                          const typeLabel = isAiGenerated
                            ? "AI-Assisted"
                            : sourceType === "transcript"
                              ? "Video"
                              : sourceType === "epic_learning"
                                ? "Article"
                                : "Docs";
                          const Wrapper = url ? "a" : "div";
                          const wrapperProps = url
                            ? {
                                href: url,
                                target: "_blank",
                                rel: "noopener noreferrer",
                              }
                            : {};
                          return (
                            <Wrapper
                              key={i}
                              {...wrapperProps}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "14px 18px",
                                background: "rgba(88, 166, 255, 0.06)",
                                border: "1px solid var(--border-color, #30363d)",
                                borderRadius: "10px",
                                color: url
                                  ? "var(--accent-blue, #58a6ff)"
                                  : "var(--text-secondary, #8b949e)",
                                textDecoration: "none",
                                transition: "all 0.2s",
                                fontSize: "0.9rem",
                                cursor: url ? "pointer" : "default",
                              }}
                              onMouseEnter={(e) => {
                                if (url)
                                  e.currentTarget.style.background = "rgba(88, 166, 255, 0.12)";
                              }}
                              onMouseLeave={(e) => {
                                if (url)
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
                              {url && (
                                <i
                                  className="fa-solid fa-arrow-up-right-from-square"
                                  style={{ opacity: 0.5, fontSize: "0.8rem" }}
                                />
                              )}
                            </Wrapper>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (expandedStep ?? 0) >= 0 && (expandedStep ?? 0) < pathData.path.length ? (
                  <div className="step-content-container">
                    <PathStep
                      key={`step-${expandedStep ?? 0}`}
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
                      editorContext={stepDeepDives[expandedStep ?? 0]?.editorContext || ""}
                      onGoDeeper={() => handleGoDeeper(expandedStep ?? 0)}
                      query={query}
                      struggleBadge={struggleBadges.get(
                        pathData.path[expandedStep ?? 0]?.segment?.title ||
                          pathData.path[expandedStep ?? 0]?.segment?.videoTitle ||
                          pathData.path[expandedStep ?? 0]?.title ||
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
                    if (expandedStep === -4) {
                      setExpandedStep(-3); // Review → Reading
                    } else if (expandedStep === -3) {
                      setExpandedStep(-2); // Reading → Quiz
                    } else if (expandedStep === -2) {
                      setExpandedStep(pathData.path.length - 1); // From quiz, go to last step
                    } else {
                      const cur = expandedStep ?? 0;
                      if (cur > 0) setExpandedStep(cur - 1);
                    }
                  }}
                  disabled={
                    (expandedStep ?? 0) <= 0 &&
                    expandedStep !== -2 &&
                    expandedStep !== -3 &&
                    expandedStep !== -4
                  }
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <div className="footer-status">
                  {expandedStep === -4
                    ? "Review"
                    : expandedStep === -2
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
                    } else if (expandedStep === -3) {
                      setExpandedStep(-4); // Further reading → review
                    }
                  }}
                  disabled={expandedStep === -4}
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
