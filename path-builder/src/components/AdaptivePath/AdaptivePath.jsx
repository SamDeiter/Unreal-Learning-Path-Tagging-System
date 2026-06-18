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
import { X } from "lucide-react";
import useAdaptiveQuiz from "../../hooks/useAdaptiveQuiz";
import usePathQuiz from "../../hooks/usePathQuiz";
import usePathStepActions from "../../hooks/usePathStepActions";
import { sanitizeQuery, checkRateLimit, recordQuery } from "../../services/securityGuardrails";
import { generateBespokePath } from "../../services/bespokePathService";
import { generateGapFillStep, generateBespokeGapStep } from "../../services/pathGapAnalyzer";
import { findCachedPath, cachePath } from "../../services/pathCacheService";
import { trackSessionCompleted, trackGapFillCompleted, trackGapAutoFillCompleted } from "../../services/analyticsService";
import { insertAtPhasePosition } from "../../utils/insertAtPhasePosition";
import PathStep from "../BespokePath/PathStep";
import { getStruggleBadges } from "../../services/struggleBadgeService";
import { loadRecentQueries, saveRecentQuery, deleteRecentQuery } from "../../utils/recentQueriesStore";
import PRE_SEEDED_PATHS from "../../data/preSeededPaths";
import PreSeededPaths from "../BespokePath/PreSeededPaths";
import "../BespokePath/BespokePath.css";
import "./AdaptivePath.css";
import LevelPicker from "./LevelPicker";
import AdaptiveSidebar from "./AdaptiveSidebar";
import FurtherReading from "./FurtherReading";
import PathFooter from "./PathFooter";
import AdaptiveQuizPhase from "./AdaptiveQuizPhase";

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
  const [feasibilityFailed, setFeasibilityFailed] = useState(false);
  const [aiWarning, setAiWarning] = useState(null);

  // Step expansion
  const [expandedStep, setExpandedStep] = useState(null);
  const [pipelineStep, setPipelineStep] = useState(0);

  // Voice selector
  const [voiceName, setVoiceName] = useState("Kore");

  // Engine selection
  const [engine, setEngine] = useState("UE5");

  const [recentQueries, setRecentQueries] = useState([]);

  // Load recent queries on mount
  useEffect(() => {
    setRecentQueries(loadRecentQueries());
  }, []);

  const [struggleBadges, setStruggleBadges] = useState(new Map());

  // ── Gap fill state ──
  const [fillResults, setFillResults] = useState({});
  const [fillingGap, setFillingGap] = useState(null);
  const [bulkFilling, setBulkFilling] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

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
    setFeasibilityFailed(false);
    setAiWarning(null);
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

      // Generate path with knowledge profile context and engine
      const queryWithEngine = engine === "UEFN" ? `[UEFN/Verse Context] ${query}` : query;
      const result = await generateBespokePath(queryWithEngine, knowledgeProfile);

      if (result.error) {
        setPathError(result.error);
      } else {
        setPathData(result);
        setExpandedStep(0);
        setIsAiGenerated(!!result.isAiGenerated);
        setFeasibilityFailed(!!result.feasibilityFailed);
        setAiWarning(result.aiGeneratedWarning || null);
        cachePath(profileKey, result);

        // ── Track auto-filled gaps for analytics ──
        const autoFilledSteps = (result.path || []).filter((s) => s.isAutoGapFill);
        for (const step of autoFilledSteps) {
          trackGapAutoFillCompleted(
            step.title || step.segment?.title || "unknown",
            step.segment?.gapFillSource || "unknown",
            autoFilledSteps.length,
            query?.substring(0, 100),
            "adaptive"
          );
        }
      }
    } catch (err) {
      setPathError(err.message || "Failed to generate learning path.");
    } finally {
      timers.forEach(clearTimeout);
      setPathLoading(false);
    }
  }, [query, knowledgeProfile, engine]);

  // Auto-generate path when skipping diagnostic (saved profile)
  useEffect(() => {
    if (pendingGeneration && query && knowledgeProfile && !pathLoading) {
      setPendingGeneration(false);
      handleGeneratePath();
    }
  }, [pendingGeneration, query, knowledgeProfile, pathLoading, handleGeneratePath]);

  // Fetch struggle badges when path changes
  useEffect(() => {
    if (!pathData || !pathData.path || pathData.path.length === 0) return;
    getStruggleBadges(pathData.path).then((badges) => {
      setStruggleBadges(badges);
    });
  }, [pathData]);

  /**
   * Start over completely
   */
  const handleDeleteQuery = useCallback((e, q) => {
    e.stopPropagation();
    deleteRecentQuery(q);
    setRecentQueries(loadRecentQueries());
  }, []);

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

  // ── Gap fill handlers ──
  const handleFillGap = useCallback(
    async (topic) => {
      if (fillingGap || !pathData) return;
      setFillingGap(topic);
      try {
        const existingCodes = pathData.path.map((s) => s.segment?.id || s.code).filter(Boolean);
        const result = await generateGapFillStep(
          topic,
          pathData.query || query,
          pathData.path,
          existingCodes
        );
        setFillResults((prev) => ({ ...prev, [topic]: result }));
        trackGapFillCompleted(topic, result?.source || "error", false, query);
      } catch {
        setFillResults((prev) => ({ ...prev, [topic]: { error: true } }));
      } finally {
        setFillingGap(null);
      }
    },
    [fillingGap, pathData, query]
  );

  const handleAddLibraryCourse = useCallback(
    (courseMatch, topic) => {
      const wrappedStep = {
        category: "core",
        segment: {
          id: courseMatch.code,
          title: courseMatch.title,
          type: "gap_fill",
          gapFillSource: "library",
        },
        isAutoGapFill: true,
        title: courseMatch.title,
        summary: `Library course added to fill gap: ${topic}`,
      };
      setPathData((prev) => ({
        ...prev,
        path: insertAtPhasePosition(prev.path, wrappedStep),
      }));
      setFillResults((prev) => ({
        ...prev,
        [topic]: { ...prev[topic], addedCode: courseMatch.code },
      }));
      trackGapFillCompleted(topic, "library", true, query);
    },
    [query]
  );

  const handleAddSegment = useCallback(
    (segment, topic, segIndex) => {
      const wrappedStep = {
        category: "core",
        segment: {
          id: `gap-seg-${Date.now()}-${segIndex}`,
          title: segment.title || `${topic} Segment`,
          text: segment.text || "",
          type: "gap_fill",
          videoTitle: segment.videoTitle || "",
          gapFillSource: "bespoke",
        },
        isAutoGapFill: true,
        title: segment.title || topic,
        summary: segment.text || "",
      };
      setPathData((prev) => ({
        ...prev,
        path: insertAtPhasePosition(prev.path, wrappedStep),
      }));
      setFillResults((prev) => ({
        ...prev,
        [topic]: {
          ...prev[topic],
          addedSegments: [...(prev[topic]?.addedSegments || []), segIndex],
        },
      }));
      trackGapFillCompleted(topic, "bespoke", true, query);
    },
    [query]
  );

  const handleBespokeGenerate = useCallback(
    (segments, topic) => {
      const bespokeStep = generateBespokeGapStep(topic, segments);
      const wrappedStep = {
        category: "core",
        segment: bespokeStep,
        isAutoGapFill: true,
      };
      setPathData((prev) => ({
        ...prev,
        path: insertAtPhasePosition(prev.path, wrappedStep),
      }));
      setFillResults((prev) => ({
        ...prev,
        [topic]: { ...prev[topic], bespokeGenerated: true },
      }));
      trackGapFillCompleted(topic, "bespoke", true, query);
    },
    [query]
  );

  const handleExploreGap = useCallback((topic) => {
    const searchUrl = `https://www.google.com/search?q=site%3Adev.epicgames.com+unreal+engine+${encodeURIComponent(topic || "")}`;
    window.open(searchUrl, "_blank", "noopener,noreferrer");
  }, []);

  const handleFillAllGaps = useCallback(
    async (blindSpots = []) => {
      if (!pathData || bulkFilling) return;
      const unfilled = blindSpots.filter((bs) => !fillResults[bs.topic]);
      if (unfilled.length === 0) return;

      setBulkFilling(true);
      setBulkProgress({ done: 0, total: unfilled.length });

      for (let i = 0; i < unfilled.length; i++) {
        const topic = unfilled[i].topic;
        try {
          const existingCodes = pathData.path.map((s) => s.segment?.id || s.code).filter(Boolean);
          const result = await generateGapFillStep(
            topic,
            pathData.query || query,
            pathData.path,
            existingCodes
          );
          setFillResults((prev) => ({ ...prev, [topic]: result }));
          trackGapFillCompleted(topic, result?.source || "error", false, query);
        } catch {
          setFillResults((prev) => ({ ...prev, [topic]: { error: true } }));
        }
        setBulkProgress({ done: i + 1, total: unfilled.length });
      }

      setBulkFilling(false);
    },
    [pathData, query, fillResults, bulkFilling]
  );


  // ── RENDER: Input Stage ──
  if (!showLevelPicker && !pathLoading && !pendingGeneration && !pathData) {
    return (
      <div className="adaptive-path">
        <div className="adaptive-input-section">
          <div className="adaptive-header-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
            <div>
              <h1 className="adaptive-title">🎯 Adaptive Learning Path</h1>
              <p className="adaptive-subtitle">
                Tell us what you want to learn about. We'll tailor a personalized path based on
                your experience level.
              </p>
            </div>
            <div className="engine-toggle">
              <button
                type="button"
                className={`toggle-btn ${engine === "UE5" ? "active" : ""}`}
                onClick={() => setEngine("UE5")}
              >
                UE5
              </button>
              <button
                type="button"
                className={`toggle-btn ${engine === "UEFN" ? "active" : ""}`}
                onClick={() => setEngine("UEFN")}
              >
                UEFN
              </button>
            </div>
          </div>

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
                    <div key={i} className="recent-query-wrapper">
                      <button className="recent-query-card" onClick={() => setQuery(q)}>
                        {q}
                      </button>
                      <button
                        className="recent-query-delete"
                        onClick={(e) => handleDeleteQuery(e, q)}
                        aria-label={`Delete recent query: ${q}`}
                        title="Delete query"
                      >
                        <X size={14} />
                      </button>
                    </div>
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
          {feasibilityFailed ? (
            <>
              <div style={{
                fontSize: '2.5rem',
                marginBottom: '12px',
                filter: 'grayscale(0.2)',
              }}>🚫</div>
              <h3 style={{
                color: '#f0f0f0',
                margin: '0 0 8px 0',
                fontSize: '1.1rem',
              }}>Topic Not Covered</h3>
              <p className="adaptive-error-msg" style={{
                color: '#94a3b8',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}>{pathError}</p>
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'rgba(99, 102, 241, 0.08)',
                borderRadius: '8px',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}>
                <p style={{ color: '#a5b4fc', fontSize: '0.78rem', margin: '0 0 8px 0' }}>
                  💡 Try one of these UE5 topics:
                </p>
                {['Blueprint communication', 'Niagara particle systems', 'Landscape & terrain', 'C++ gameplay programming'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setQuery(suggestion);
                      setPathError(null);
                      setFeasibilityFailed(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '6px 10px',
                      margin: '4px 0',
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      borderRadius: '6px',
                      color: '#c7d2fe',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.2s',
                    }}
                    onMouseOver={(e) => e.target.style.background = 'rgba(99, 102, 241, 0.25)'}
                    onMouseOut={(e) => e.target.style.background = 'rgba(99, 102, 241, 0.12)'}
                  >
                    → {suggestion}
                  </button>
                ))}
              </div>
              <button className="adaptive-retry-btn" onClick={handleReset} style={{ marginTop: '16px' }}>
                Try Something Else
              </button>
            </>
          ) : (
            <>
              <p className="adaptive-error-msg">⚠️ {pathError}</p>
              <button className="adaptive-retry-btn" onClick={handleReset}>
                Start Over
              </button>
            </>
          )}
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

            <AdaptiveSidebar
              phases={phases}
              activePhaseKey={activePhaseKey}
              pathData={pathData}
              expandedStep={expandedStep}
              setExpandedStep={setExpandedStep}
              voiceName={voiceName}
              setVoiceName={setVoiceName}
              knowledgeProfile={knowledgeProfile}
              hasSavedProfile={hasSavedProfile}
              clearProfile={clearProfile}
              setShowLevelPicker={setShowLevelPicker}
              setPendingCleanedQuery={setPendingCleanedQuery}
              query={query}
              gapData={pathData.gaps}
              fillResults={fillResults}
              onFillGap={handleFillGap}
              onExplore={handleExploreGap}
              onAddCourse={handleAddLibraryCourse}
              onAddSegment={handleAddSegment}
              onGenerateBespoke={handleBespokeGenerate}
              onFillAllGaps={handleFillAllGaps}
              bulkFilling={bulkFilling}
              bulkProgress={bulkProgress}
            />

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
                      color: "#fbbf24",
                      background: "rgba(251, 191, 36, 0.06)",
                      border: "1px solid rgba(251, 191, 36, 0.15)",
                      borderRadius: "8px",
                      margin: "0 0 16px 0",
                    }}
                  >
                    {aiWarning || "⚠️ Generated from AI knowledge — not from our verified course library"}
                    <br />
                    <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>
                      💡 Tip: Adding UE5-specific terms (e.g. &quot;horse <em>character in UE5</em>
                      &quot;) can unlock even more tailored results.
                    </span>
                  </div>
                )}

                {expandedStep === -2 ? (
                  <AdaptiveQuizPhase
                    quizzes={quizzes}
                    quizScores={quizScores}
                    showQuiz={showQuiz}
                    quizLoading={quizLoading}
                    handleTakeQuiz={handleTakeQuiz}
                    handleQuizComplete={handleQuizComplete}
                  />
                ) : expandedStep === -3 ? (
                  <FurtherReading steps={pathData.path} />
                ) : expandedStep === -4 ? (
                  /* ── Review Phase: path summary & recap ── */
                  <div className="step-content-container" style={{ padding: "24px" }}>
                    <h2 style={{ color: "var(--accent-green, #4ade80)", marginBottom: "8px" }}>
                      ✅ Path Review
                    </h2>
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "24px" }}>
                      Here&apos;s a recap of everything covered in this learning path.
                    </p>
                    {[
                      { label: "Prerequisites", categories: ["prerequisite", "foundation", "diagnosis"] },
                      { label: "Core Steps", categories: ["core", "fix"] },
                      { label: "Practice", categories: ["practice", "transfer"] },
                    ].map(({ label, categories }) => {
                      const steps = pathData.path.filter((s) => categories.includes(s.category));
                      if (steps.length === 0) return null;
                      return (
                        <div key={label} style={{ marginBottom: "20px" }}>
                          <h3 style={{ color: "#e2e8f0", fontSize: "0.9rem", marginBottom: "8px" }}>
                            {label}
                          </h3>
                          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {steps.map((step, i) => (
                              <li
                                key={i}
                                style={{
                                  padding: "10px 14px",
                                  marginBottom: "6px",
                                  background: "rgba(255,255,255,0.03)",
                                  borderRadius: "8px",
                                  borderLeft: "3px solid var(--accent-blue, #60a5fa)",
                                }}
                              >
                                <strong style={{ color: "#e2e8f0", fontSize: "0.82rem" }}>
                                  {step.title || step.segment?.title || step.segment?.videoTitle || `Step ${i + 1}`}
                                </strong>
                                {step.summary && (
                                  <p style={{ color: "#94a3b8", fontSize: "0.75rem", margin: "4px 0 0" }}>
                                    {step.summary}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
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

              <PathFooter
                expandedStep={expandedStep}
                setExpandedStep={setExpandedStep}
                totalSteps={pathData.path.length}
                pathData={pathData}
              />
            </main>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
