/**
 * PathIntelligencePanel v3 — Tabbed intelligence sidebar
 *
 * Tabs: Coverage | Gaps | Quiz | Review | Export
 * Only ONE tab visible at a time. Clean and focused.
 * Setup gate shown when Primary Goal is missing.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePath } from "../../context/PathContext";
import {
  analyzePathGaps,
  generateGapFillStep,
  generateBespokeGapStep,
} from "../../services/pathGapAnalyzer";
import { generateQuizForPath } from "../../services/quizService";
import { detectPersona } from "../../services/PersonaService";
import { useAugmentationData } from "../../hooks/useAugmentationData";
import {
  buildContentSummary,
  enrichGuideWithBloom,
  generateFlashcards,
  generateQuickQuiz,
} from "../../services/studyGuideGenerator";
import { downloadScormPackage } from "../../services/scormPackager";
import PathWizard from "../BespokePath/PathWizard";
import "./PathIntelligencePanel.css";

const INDUSTRIES = [
  "All",
  "General",
  "Games",
  "Film & Television",
  "Architecture",
  "Simulation",
  "Automotive",
  "Media & Entertainment",
];

// ── Coverage Gauge ─────────────────────────────────────────
function CoverageGauge({ score }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.round(Math.max(0, Math.min(100, score * 100)));
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 80 ? "#3fb950" : pct >= 50 ? "#d29922" : pct >= 1 ? "#f85149" : "#484f58";

  return (
    <div className="ip-gauge">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} className="ip-gauge-bg" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          className="ip-gauge-fill"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ip-gauge-label" style={{ color }}>
        <span className="ip-gauge-pct">{pct}%</span>
        <span className="ip-gauge-sub">coverage</span>
      </div>
    </div>
  );
}

// ── Tab definitions ──
const TABS = [
  { id: "coverage", icon: "📊", label: "Coverage" },
  { id: "gaps", icon: "⚠", label: "Gaps" },
  { id: "quiz", icon: "📝", label: "Quiz" },
  { id: "review", icon: "✅", label: "Review" },
  { id: "export", icon: "📦", label: "Export" },
];

// ── Main ───────────────────────────────────────────────────
export default function PathIntelligencePanel() {
  const { courses, learningIntent, setLearningIntent, pathStats, addCourse } = usePath();
  const { getCourseSummary } = useAugmentationData();

  const handleFieldChange = useCallback(
    (field, value) => {
      setLearningIntent({ [field]: value });
    },
    [setLearningIntent]
  );

  const detectedPersona = useMemo(() => {
    if (!learningIntent?.primaryGoal) return null;
    return detectPersona(learningIntent.primaryGoal);
  }, [learningIntent?.primaryGoal]);

  const [activeTab, setActiveTab] = useState("coverage");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [fillingGap, setFillingGap] = useState(null);
  const [fillResults, setFillResults] = useState({});
  const [quiz, setQuiz] = useState(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [studyGuide, setStudyGuide] = useState(null);
  const [flashcards, setFlashcards] = useState(null);
  const [quickQuiz, setQuickQuiz] = useState(null);
  const [exportingScorm, setExportingScorm] = useState(false);

  // Auto-populate from wizard intent (one-time read)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ue5_wizard_intent");
      if (raw) {
        const intent = JSON.parse(raw);
        setLearningIntent(intent);
        localStorage.removeItem("ue5_wizard_intent");
      }
    } catch {
      /* ignore parse errors */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sync courseCount + totalMinutes to dashboard storage when courses change
  useEffect(() => {
    if (courses.length === 0) return;
    try {
      const raw = localStorage.getItem("ue5_saved_paths");
      if (!raw) return;
      const paths = JSON.parse(raw);
      // Find the most recently updated path and sync its stats
      const sorted = [...paths].sort(
        (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
      );
      if (sorted.length > 0) {
        const active = sorted[0];
        active.courseCount = courses.length;
        active.totalMinutes = pathStats.totalMinutes || 0;
        active.updatedAt = new Date().toISOString();
        localStorage.setItem("ue5_saved_paths", JSON.stringify(paths));
      }
    } catch {
      /* ignore sync errors */
    }
  }, [courses.length, pathStats.totalMinutes]);

  const hasCourses = courses.length > 0;
  const hasGoal = !!learningIntent?.primaryGoal?.trim();
  const hasLevel = !!learningIntent?.skillLevel;
  const hasBudget = !!learningIntent?.timeBudget;
  const setupComplete = hasGoal && hasLevel && hasBudget;
  const isReady = hasCourses && setupComplete;

  const pathResult = useMemo(() => {
    if (!isReady) return null;
    return {
      query: learningIntent.primaryGoal,
      path: courses.map((c, i) => ({
        category: c.role?.toLowerCase() === "prerequisite" ? "foundation" : "core",
        title: c.title || `Step ${i + 1}`,
        segment: {
          title: c.title || `Step ${i + 1}`,
          text: c.description || c.why || "",
          source: c.instructor || c.platform || "",
          type: c.type || "video",
        },
      })),
      bridges: [],
      gaps: analysis,
    };
  }, [isReady, courses, learningIntent, analysis]);

  // ── Analyze ──
  const handleAnalyze = useCallback(async () => {
    if (!isReady || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const steps = courses.map((c) => ({
        category: c.role?.toLowerCase() === "prerequisite" ? "foundation" : "core",
        segment: { title: c.title || "Untitled", text: c.description || c.why || "" },
      }));
      const result = await analyzePathGaps(learningIntent.primaryGoal, steps);
      setAnalysis(result);
    } catch (err) {
      setError(err.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [isReady, analyzing, courses, learningIntent]);

  // ── Fill Gap ──
  const handleFillGap = useCallback(
    async (topic) => {
      if (fillingGap) return;
      setFillingGap(topic);
      try {
        const steps = courses.map((c) => ({
          category: "core",
          segment: { title: c.title || "", text: c.description || "" },
        }));
        const existingCodes = courses.map((c) => c.code).filter(Boolean);
        const result = await generateGapFillStep(
          topic,
          learningIntent.primaryGoal,
          steps,
          existingCodes
        );
        setFillResults((prev) => ({ ...prev, [topic]: result }));
      } catch {
        setFillResults((prev) => ({ ...prev, [topic]: { error: true } }));
      } finally {
        setFillingGap(null);
      }
    },
    [fillingGap, courses, learningIntent]
  );

  // ── Add library course from gap fill result ──
  const handleAddLibraryCourse = useCallback(
    (courseMatch, topic) => {
      addCourse({
        code: courseMatch.code,
        title: courseMatch.title,
        role: "core",
        isGapFill: true,
        gapTopic: topic,
      });
      // Mark as added in fill results
      setFillResults((prev) => ({
        ...prev,
        [topic]: { ...prev[topic], addedCode: courseMatch.code },
      }));
    },
    [addCourse]
  );

  // ── Generate bespoke step from segments ──
  const handleBespokeGenerate = useCallback(
    (segments, topic) => {
      const bespokeStep = generateBespokeGapStep(topic, segments);
      addCourse(bespokeStep);
      setFillResults((prev) => ({
        ...prev,
        [topic]: { ...prev[topic], bespokeGenerated: true },
      }));
    },
    [addCourse]
  );

  // ── Add a single video segment as a path step ──
  const handleAddSegment = useCallback(
    (segment, topic, segIndex) => {
      addCourse({
        code: `bespoke-${topic}-${segIndex}`,
        title: segment.title || `${topic} Segment`,
        description: segment.text || "",
        videoTitle: segment.videoTitle || "",
        role: "core",
        type: "bespoke-segment",
        isGapFill: true,
        gapTopic: topic,
      });
      setFillResults((prev) => ({
        ...prev,
        [topic]: {
          ...prev[topic],
          addedSegments: [...(prev[topic]?.addedSegments || []), segIndex],
        },
      }));
    },
    [addCourse]
  );

  // ── Quiz ──
  const handleGenerateQuiz = useCallback(async () => {
    if (!pathResult || generatingQuiz) return;
    setGeneratingQuiz(true);
    try {
      const quizMap = await generateQuizForPath(pathResult.path, learningIntent.primaryGoal, 2);
      // generateQuizForPath returns a Map<stepIndex, questions[]>
      // Flatten into a single array for the UI
      const allQuestions = [];
      if (quizMap instanceof Map) {
        for (const questions of quizMap.values()) {
          allQuestions.push(...questions);
        }
      } else if (Array.isArray(quizMap)) {
        allQuestions.push(...quizMap);
      }
      setQuiz(allQuestions);
    } catch {
      setQuiz([]);
    } finally {
      setGeneratingQuiz(false);
    }
  }, [pathResult, generatingQuiz, learningIntent]);

  // Derived
  const blindSpots = analysis?.blindSpots || [];
  const suggestions = analysis?.suggestions || [];
  const assumedKnowledge = analysis?.assumedKnowledge || [];
  const weaklyCovered = analysis?.weaklyCovered || [];
  const coverageScoreRaw = analysis?.coverageScore ?? 0;
  const corpusStats = analysis?.corpusStats || {};

  // Count successfully filled gaps
  const filledCount = Object.values(fillResults).filter(
    (f) => f && !f.error && (f.addedCode || f.generated)
  ).length;

  // Gap count decreases as gaps are filled
  const totalGaps = blindSpots.length + weaklyCovered.length;
  const gapCount = Math.max(0, totalGaps - filledCount);

  // Coverage score increases as gaps are filled (proportional boost)
  const coverageScore = totalGaps > 0
    ? Math.min(1, coverageScoreRaw + (filledCount / totalGaps) * (1 - coverageScoreRaw))
    : coverageScoreRaw;

  // ── RENDER ──
  return (
    <div className="ip-panel">
      {/* Header */}
      <div className="ip-header">
        <span className="ip-logo">🧠</span>
        <h3>Path Intelligence</h3>
      </div>

      {/* Gate: inline setup form */}
      {!setupComplete ? (
        <div className="ip-setup">
          <div className="ip-setup-header">
            <span>🎯</span>
            <h4>Define Your Path</h4>
          </div>

          <div className="ip-field">
            <label>Primary Goal *</label>
            <input
              type="text"
              placeholder="e.g. Master Lumen Lighting"
              value={learningIntent.primaryGoal || ""}
              onChange={(e) => handleFieldChange("primaryGoal", e.target.value)}
            />
            {detectedPersona && <span className="ip-persona-badge">👤 {detectedPersona.name}</span>}
          </div>

          <div className="ip-field">
            <label>Skill Level *</label>
            <select
              value={learningIntent.skillLevel || ""}
              onChange={(e) => handleFieldChange("skillLevel", e.target.value)}
            >
              <option value="">Select Level…</option>
              <option value="Beginner">Beginner (New to topic)</option>
              <option value="Intermediate">Intermediate (Some exp)</option>
              <option value="Advanced">Advanced (Expert)</option>
            </select>
          </div>

          <div className="ip-field">
            <label>Time Budget</label>
            <select
              value={learningIntent.timeBudget || ""}
              onChange={(e) => handleFieldChange("timeBudget", e.target.value)}
            >
              <option value="">Select…</option>
              <option value="5">
                ~5 Hours{learningIntent.skillLevel === "Beginner" ? " ★ Recommended" : ""}
              </option>
              <option value="10">
                ~10 Hours{learningIntent.skillLevel === "Intermediate" ? " ★ Recommended" : ""}
              </option>
              <option value="15">
                ~15 Hours{learningIntent.skillLevel === "Intermediate" ? " ★ Max" : ""}
              </option>
              <option value="20">
                ~20 Hours{learningIntent.skillLevel === "Advanced" ? " ★ Recommended" : ""}
              </option>
              <option value="25">
                ~25 Hours{learningIntent.skillLevel === "Advanced" ? " ★ Max" : ""}
              </option>
              <option value="none">No Limit</option>
            </select>
            {learningIntent.skillLevel && (
              <span className="ip-field-hint">
                {learningIntent.skillLevel === "Beginner" && "📖 Research: ≤5h for beginners"}
                {learningIntent.skillLevel === "Intermediate" &&
                  "📖 Research: 5–15h for intermediate"}
                {learningIntent.skillLevel === "Advanced" && "📖 Research: 10–25h for advanced"}
              </span>
            )}
          </div>

          <div className="ip-field">
            <label>Industry Focus</label>
            <div className="ip-industry-chips">
              <button
                type="button"
                className={`ip-industry-chip ${!learningIntent.industries?.length ? "selected" : ""}`}
                onClick={() => handleFieldChange("industries", [])}
              >
                All
              </button>
              {INDUSTRIES.filter((i) => i !== "All").map((ind) => (
                <button
                  key={ind}
                  type="button"
                  className={`ip-industry-chip ${learningIntent.industries?.includes(ind) ? "selected" : ""}`}
                  onClick={() => {
                    const prev = learningIntent.industries || [];
                    const next = prev.includes(ind)
                      ? prev.filter((i) => i !== ind)
                      : [...prev, ind];
                    handleFieldChange("industries", next);
                  }}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>

          <div className="ip-setup-progress">
            <div className="ip-progress-bar">
              <div
                className="ip-progress-fill"
                style={{
                  width: `${([hasGoal, hasLevel, hasBudget].filter(Boolean).length / 3) * 100}%`,
                }}
              />
            </div>
            <span>{[hasGoal, hasLevel, hasBudget].filter(Boolean).length}/3 complete</span>
          </div>
        </div>
      ) : !hasCourses ? (
        <div className="ip-gate">
          <div className="ip-gate-icon">📚</div>
          <h4>Add Courses</h4>
          <p>Drag courses from the left panel to build your path.</p>
        </div>
      ) : (
        <>
          {/* Compact summary of setup */}
          <div className="ip-summary">
            <span className="ip-summary-goal">{learningIntent.primaryGoal}</span>
            <span className="ip-summary-meta">
              {learningIntent.skillLevel} ·{" "}
              {learningIntent.timeBudget === "none" ? "No Limit" : `~${learningIntent.timeBudget}h`}
              {learningIntent.industries?.length > 0 && (
                <> · {learningIntent.industries.join(", ")}</>
              )}
            </span>
            <div className="ip-industry-chips ip-industry-chips-compact">
              <button
                type="button"
                className={`ip-industry-chip ${!learningIntent.industries?.length ? "selected" : ""}`}
                onClick={() => handleFieldChange("industries", [])}
              >
                All
              </button>
              {INDUSTRIES.filter((i) => i !== "All").map((ind) => (
                <button
                  key={ind}
                  type="button"
                  className={`ip-industry-chip ${learningIntent.industries?.includes(ind) ? "selected" : ""}`}
                  onClick={() => {
                    const prev = learningIntent.industries || [];
                    const next = prev.includes(ind)
                      ? prev.filter((i) => i !== ind)
                      : [...prev, ind];
                    handleFieldChange("industries", next);
                  }}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Bar */}
          <div className="ip-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`ip-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="ip-tab-icon">{tab.icon}</span>
                <span className="ip-tab-label">{tab.label}</span>
                {tab.id === "gaps" && gapCount > 0 && (
                  <span className="ip-tab-badge">{gapCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="ip-content">
            {/* ════ COVERAGE TAB ════ */}
            {activeTab === "coverage" && (
              <div className="ip-tab-pane">
                <CoverageGauge score={coverageScore} />

                <div className="ip-stats">
                  <div className="ip-stat">
                    <span>Courses</span>
                    <strong>{pathStats.courseCount}</strong>
                  </div>
                  <div className="ip-stat">
                    <span>Est. Time</span>
                    <strong>
                      {pathStats.estimatedHours}h
                      {learningIntent?.timeBudget && learningIntent.timeBudget !== "none" && pathStats.estimatedHours > Number(learningIntent.timeBudget) && (
                        <span
                          className="ip-budget-warn"
                          title={`Path is ${pathStats.estimatedHours}h but your budget is ${learningIntent.timeBudget}h`}
                          style={{
                            marginLeft: 4,
                            fontSize: "0.7rem",
                            color: pathStats.estimatedHours > Number(learningIntent.timeBudget) * 2 ? "#f85149" : "#d29922",
                          }}
                        >
                          {pathStats.estimatedHours > Number(learningIntent.timeBudget) * 2 ? "🔴" : "⚠️"}
                        </span>
                      )}
                    </strong>
                  </div>
                  {pathStats.levelRange && (
                    <div className="ip-stat">
                      <span>Levels</span>
                      <strong>{pathStats.levelRange}</strong>
                    </div>
                  )}
                  {analysis && (
                    <div className="ip-stat">
                      <span>Topics Covered</span>
                      <strong>
                        {corpusStats.subtopicsCovered || 0} / {corpusStats.subtopicsChecked || 0}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Research-backed time health warning */}
                {learningIntent?.skillLevel &&
                  pathStats.estimatedHours > 0 &&
                  (() => {
                    const TIME_LIMITS = {
                      Beginner: {
                        max: 5,
                        label: "Beginner",
                        research: "learners lose focus past 5h — chunk into 3–5 min segments",
                      },
                      Foundation: {
                        max: 5,
                        label: "Beginner",
                        research: "learners lose focus past 5h — chunk into 3–5 min segments",
                      },
                      Intermediate: {
                        max: 15,
                        label: "Intermediate",
                        research: "can handle longer sessions but fatigue sets in past 15h",
                      },
                      Advanced: {
                        max: 25,
                        label: "Advanced",
                        research:
                          "self-directed learning allows up to 25h but diminishing returns beyond",
                      },
                    };
                    const limit = TIME_LIMITS[learningIntent.skillLevel];
                    if (!limit) return null;
                    const hours = pathStats.estimatedHours;
                    const exceeds = hours > limit.max;
                    return (
                      <div className={`ip-time-warning ${exceeds ? "warn" : "ok"}`}>
                        {exceeds
                          ? `⚠️ ${hours}h exceeds recommended ${limit.max}h for ${limit.label} — ${limit.research}`
                          : `✅ ${hours}h within ${limit.max}h ${limit.label} range`}
                      </div>
                    );
                  })()}
                {courses.length > 0 &&
                  (() => {
                    const augCourses = courses
                      .map((c) => ({ code: c.code, title: c.title, aug: getCourseSummary(c.code) }))
                      .filter((c) => c.aug);
                    if (augCourses.length === 0) return null;
                    const avgScore = Math.round(
                      augCourses.reduce((s, c) => s + c.aug.avgScore, 0) / augCourses.length
                    );
                    const avgGrade =
                      avgScore >= 45
                        ? "A"
                        : avgScore >= 39
                          ? "B"
                          : avgScore >= 33
                            ? "C"
                            : avgScore >= 22
                              ? "D"
                              : "F";
                    const needsAug = augCourses.filter(
                      (c) => c.aug.avgGrade === "D" || c.aug.avgGrade === "F"
                    );
                    return (
                      <div className="ip-aug-card">
                        <div className="ip-aug-header">
                          <span className={`ip-aug-grade aug-badge aug-${avgGrade}`}>
                            {avgGrade}
                          </span>
                          <div>
                            <strong>Augmentation Quality</strong>
                            <span className="ip-aug-sub">
                              {avgScore}/55 avg · {augCourses.length}/{courses.length} courses
                              analyzed
                            </span>
                          </div>
                        </div>
                        {needsAug.length > 0 && (
                          <div className="ip-aug-alert">
                            ⚡ {needsAug.length} course{needsAug.length > 1 ? "s" : ""} rated D/F —
                            pedagogy needs augmentation
                          </div>
                        )}
                        <div className="ip-aug-list">
                          {augCourses.map((c) => (
                            <div key={c.code} className="ip-aug-item">
                              <span className={`ip-aug-dot aug-badge aug-${c.aug.avgGrade}`}>
                                {c.aug.avgGrade}
                              </span>
                              <span className="ip-aug-title" title={c.title}>
                                {c.code}
                              </span>
                              <span className="ip-aug-score">{c.aug.avgScore}/55</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                <button className="ip-btn primary" onClick={handleAnalyze} disabled={analyzing}>
                  {analyzing ? (
                    <>
                      <span className="ip-spinner" /> Analyzing…
                    </>
                  ) : analysis ? (
                    "🔄 Re-Analyze"
                  ) : (
                    "🔍 Analyze Path"
                  )}
                </button>

                {error && <p className="ip-error">❌ {error}</p>}

                {/* Coverage Explanation */}
                {analysis && (
                  <div
                    className={`ip-explain ${coverageScore >= 0.8 ? "good" : coverageScore >= 0.5 ? "warn" : "low"}`}
                  >
                    {coverageScore >= 0.8 ? (
                      <p>
                        <strong>✅ Great!</strong> Your path covers{" "}
                        {Math.round(coverageScore * 100)}% of key subtopics.
                      </p>
                    ) : coverageScore >= 0.5 ? (
                      <p>
                        <strong>⚠️ Partial</strong> — {Math.round(coverageScore * 100)}% covered.
                        Check the <strong>Gaps</strong> tab to see what&apos;s missing.
                      </p>
                    ) : (
                      <p>
                        <strong>🔴 Low</strong> — Only {Math.round(coverageScore * 100)}% covered.
                        Check the <strong>Gaps</strong> tab for blind spots and suggestions.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ════ GAPS TAB ════ */}
            {activeTab === "gaps" && (
              <div className="ip-tab-pane">
                {!analysis ? (
                  <div className="ip-empty">
                    <p>
                      Run analysis on the <strong>Coverage</strong> tab first to see gaps.
                    </p>
                  </div>
                ) : gapCount === 0 && suggestions.length === 0 ? (
                  <div className="ip-empty">
                    <span className="ip-empty-icon">🎉</span>
                    <p>No gaps detected! Your path looks solid.</p>
                  </div>
                ) : (
                  <>
                    {/* Blind Spots */}
                    {blindSpots.map((spot, i) => {
                      const topic = typeof spot === "string" ? spot : spot.topic;
                      const severity = spot.severity || "medium";
                      const reason = spot.reason || "";
                      const filled = fillResults[topic];
                      return (
                        <div key={i} className={`ip-gap-card ip-sev-${severity}`}>
                          <div className="ip-gap-header">
                            <span className={`ip-sev-dot ${severity}`} />
                            <strong>{topic}</strong>
                          </div>
                          {reason && <p className="ip-gap-reason">{reason}</p>}

                          {/* ── Fill Results ── */}
                          {filled ? (
                            filled.error ? (
                              <p className="ip-gap-status error">Could not generate fill</p>
                            ) : filled.source === "library" ? (
                              /* Tier 1: Library matches */
                              <div className="ip-fill-library">
                                <p className="ip-fill-tier-label">📚 Found in course library</p>
                                {filled.matchedCourses.map((mc) => (
                                  <div key={mc.code} className="ip-fill-course-match">
                                    <div className="ip-fill-course-info">
                                      <strong>{mc.title || mc.code}</strong>
                                      <span className="ip-fill-sim">
                                        {Math.round(mc.similarity * 100)}% match
                                      </span>
                                    </div>
                                    {filled.addedCode === mc.code ? (
                                      <span className="ip-gap-status success">✅ Added</span>
                                    ) : (
                                      <button
                                        className="ip-btn small"
                                        onClick={() => handleAddLibraryCourse(mc, topic)}
                                      >
                                        ➕ Add to Path
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : filled.source === "bespoke" ? (
                              /* Tier 2: Bespoke segments */
                              <div className="ip-fill-bespoke">
                                <p className="ip-fill-tier-label">🎬 Video segments found</p>
                                {filled.segments.slice(0, 3).map((seg, si) => (
                                  <div key={si} className="ip-fill-segment-preview">
                                    <div className="ip-fill-seg-row">
                                      <div className="ip-fill-seg-info">
                                        <div className="ip-fill-seg-title">{seg.title}</div>
                                        {seg.videoTitle && seg.videoTitle !== seg.title && (
                                          <div className="ip-fill-seg-video">
                                            from: {seg.videoTitle}
                                          </div>
                                        )}
                                        <span className="ip-fill-sim">
                                          {Math.round(seg.similarity * 100)}% relevance
                                        </span>
                                      </div>
                                      {filled.addedSegments?.includes(si) ? (
                                        <span className="ip-gap-status success">✅</span>
                                      ) : (
                                        <button
                                          className="ip-btn small"
                                          onClick={() => handleAddSegment(seg, topic, si)}
                                        >
                                          ➕
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {filled.bespokeGenerated ? (
                                  <span className="ip-gap-status success">
                                    ✅ Bespoke step added
                                  </span>
                                ) : (
                                  <button
                                    className="ip-btn small"
                                    onClick={() => handleBespokeGenerate(filled.segments, topic)}
                                  >
                                    🎬 Generate Bespoke Step
                                  </button>
                                )}
                              </div>
                            ) : filled.source === "ai" && filled.step ? (
                              /* Tier 3: AI-generated fallback */
                              <div className="ip-fill-ai">
                                <p className="ip-fill-tier-label">🤖 AI-generated step</p>
                                <p className="ip-gap-status success">
                                  ✅ {filled.step.segment?.title || "Fill generated"}
                                </p>
                                {filled.step.summary && (
                                  <p className="ip-fill-ai-summary">{filled.step.summary}</p>
                                )}
                              </div>
                            ) : (
                              <p className="ip-gap-status success">
                                ✅ {filled.segment?.title || filled.title || "Fill generated"}
                              </p>
                            )
                          ) : (
                            <button
                              className="ip-btn small"
                              onClick={() => handleFillGap(topic)}
                              disabled={!!fillingGap}
                            >
                              {fillingGap === topic ? "Searching…" : "🔍 Find Courses"}
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Weakly Covered */}
                    {weaklyCovered.length > 0 && (
                      <div className="ip-weak-section">
                        <h4>⚠️ Weakly Covered</h4>
                        <p className="ip-weak-desc">
                          These topics exist in your path but have low pedagogical quality.
                        </p>
                        {weaklyCovered.map((item, i) => (
                          <div key={`wc-${i}`} className="ip-gap-card ip-sev-low ip-weak-card">
                            <div className="ip-gap-header">
                              <span
                                className={`ip-sev-dot aug-badge aug-${item.augGrade}`}
                                style={{
                                  borderRadius: "4px",
                                  width: "auto",
                                  height: "auto",
                                  padding: "1px 5px",
                                  fontSize: "10px",
                                }}
                              >
                                {item.augGrade}
                              </span>
                              <strong>{item.topic}</strong>
                            </div>
                            <p className="ip-gap-reason">{item.reason}</p>
                            <button
                              className="ip-btn small aug-action-inline"
                              onClick={() => {
                                const base = import.meta.env?.BASE_URL || "/";
                                window.open(`${base}augmentation_viewer.html`, "_blank");
                              }}
                            >
                              ⚡ View Augmented Guide
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                      <div className="ip-suggestions">
                        <h4>💡 Suggestions</h4>
                        {suggestions.map((s, i) => (
                          <div key={i} className="ip-suggestion">
                            <strong>{s.topic || s}</strong>
                            {s.rationale && <p>{s.rationale}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assumed Knowledge */}
                    {assumedKnowledge.length > 0 && (
                      <div className="ip-assumed">
                        <h4>🎓 Assumed Knowledge</h4>
                        <p>Your path assumes learners already know:</p>
                        <div className="ip-chip-row">
                          {assumedKnowledge.map((ak, i) => (
                            <span key={i} className="ip-chip">
                              {ak}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ════ QUIZ TAB ════ */}
            {activeTab === "quiz" && (
              <div className="ip-tab-pane">
                <p className="ip-tab-desc">
                  Generate knowledge-check questions from your path content.
                </p>
                <div className="ip-quiz-actions">
                  <button
                    className="ip-btn primary"
                    onClick={handleGenerateQuiz}
                    disabled={generatingQuiz}
                  >
                    {generatingQuiz ? (
                      <>
                        <span className="ip-spinner" /> Generating…
                      </>
                    ) : quiz ? (
                      "🔄 Regenerate All"
                    ) : (
                      "📝 Generate Quiz"
                    )}
                  </button>
                  {quiz && quiz.length > 0 && (
                    <span className="ip-quiz-count">{quiz.length} questions</span>
                  )}
                </div>

                {quiz && quiz.length > 0 && (
                  <div className="ip-quiz-list">
                    {quiz.map((q, i) => {
                      // Support both data formats
                      const questionText = q.question || q.stem || "";
                      const explanation = q.explanation || "";
                      const correctAnswer = q.answer || q.correct || "";
                      // Handle options as array or {A,B,C,D} object
                      let options = [];
                      let correctKey = "";
                      if (Array.isArray(q.options)) {
                        options = q.options;
                        correctKey = correctAnswer;
                      } else if (q.choices) {
                        options = Object.entries(q.choices).map(([key, val]) => ({ key, val }));
                        correctKey = correctAnswer;
                      }

                      return (
                        <div key={i} className="ip-quiz-card">
                          <div className="ip-quiz-header">
                            <p className="ip-quiz-q">
                              <strong>Q{i + 1}:</strong> {questionText}
                            </p>
                          </div>
                          {Array.isArray(q.options) ? (
                            <ul className="ip-quiz-opts">
                              {options.map((opt, j) => (
                                <li key={j} className={opt === correctKey ? "correct" : ""}>
                                  {opt === correctKey && <span className="ip-quiz-check">✓</span>}
                                  {opt}
                                </li>
                              ))}
                            </ul>
                          ) : options.length > 0 ? (
                            <ul className="ip-quiz-opts">
                              {options.map(({ key, val }) => (
                                <li key={key} className={key === correctKey ? "correct" : ""}>
                                  {key === correctKey && <span className="ip-quiz-check">✓</span>}
                                  <strong>{key}.</strong> {val}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {explanation && (
                            <div className="ip-quiz-explanation">
                              <span className="ip-quiz-explain-icon">💡</span>
                              {explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {quiz && quiz.length === 0 && (
                  <p className="ip-error">Could not generate quiz questions. Try again.</p>
                )}
              </div>
            )}

            {/* ════ REVIEW TAB ════ */}
            {activeTab === "review" && (
              <div className="ip-tab-pane">
                {pathResult ? (
                  <PathWizard pathResult={pathResult} quiz={quiz} />
                ) : (
                  <div className="ip-empty">
                    <span className="ip-empty-icon">✅</span>
                    <p>Add courses and set a goal to enable path review.</p>
                  </div>
                )}
              </div>
            )}

            {/* ════ EXPORT TAB ════ */}
            {activeTab === "export" && (
              <div className="ip-tab-pane">
                {pathResult ? (
                  <div className="export-panel">
                    {/* ── Study Guide ─────────────────── */}
                    <div className="export-section">
                      <button
                        className="export-action-btn study-guide-btn"
                        onClick={() => {
                          const summary = buildContentSummary(courses);
                          const guide = enrichGuideWithBloom({
                            title: `${learningIntent?.primaryGoal || "Learning Path"} — Study Guide`,
                            sections: summary.courses.map((c) => ({
                              heading: c.title,
                              content: c.summary,
                            })),
                          });
                          setStudyGuide(guide);
                        }}
                      >
                        📄 Generate Study Guide
                      </button>
                      {studyGuide && (
                        <div className="export-preview study-guide-preview">
                          <h4>{studyGuide.title}</h4>
                          {(studyGuide.sections || []).map((s, i) => (
                            <div key={i} className="guide-section">
                              <div className="guide-heading">
                                {s.bloom && (
                                  <span
                                    className="bloom-badge-sm"
                                    style={{ color: s.bloom.color }}
                                    title={`Bloom's Taxonomy: ${s.bloom.level} — ${
                                      {
                                        Remember: "Recall facts and basic concepts",
                                        Understand: "Explain ideas or concepts",
                                        Apply: "Use information in new situations",
                                        Analyze: "Draw connections among ideas",
                                        Evaluate: "Justify a stance or decision",
                                        Create: "Produce new or original work",
                                      }[s.bloom.level] || s.bloom.level
                                    }`}
                                  >
                                    {s.bloom.emoji} {s.bloom.level}
                                  </span>
                                )}
                                <strong>{s.heading}</strong>
                              </div>
                              <p className="guide-content">{s.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── Flashcards ──────────────────── */}
                    <div className="export-section">
                      <button
                        className="export-action-btn flashcard-btn"
                        onClick={() => setFlashcards(generateFlashcards(courses))}
                      >
                        🃏 Generate Flashcards
                      </button>
                      {flashcards && (
                        <div className="export-preview flashcard-list">
                          <span className="card-count">{flashcards.length} cards</span>
                          {flashcards.slice(0, 10).map((card, i) => (
                            <div key={i} className="flashcard">
                              <div className="fc-front">
                                <strong>Q:</strong> {card.front}
                              </div>
                              <div className="fc-back">
                                <strong>A:</strong> {card.back}
                              </div>
                            </div>
                          ))}
                          {flashcards.length > 10 && (
                            <p className="more-items">+{flashcards.length - 10} more cards...</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── Quick Quiz ──────────────────── */}
                    <div className="export-section">
                      <button
                        className="export-action-btn quiz-btn"
                        onClick={() => setQuickQuiz(generateQuickQuiz(courses))}
                      >
                        📝 Generate Quick Quiz
                      </button>
                      {quickQuiz && (
                        <div className="export-preview quiz-list">
                          <span className="card-count">{quickQuiz.length} questions</span>
                          {quickQuiz.map((q, i) => (
                            <div key={i} className="quiz-question">
                              <p className="qq-prompt">
                                {i + 1}. {q.question}
                              </p>
                              <ul className="qq-options">
                                {q.options.map((opt, j) => (
                                  <li key={j} className={j === q.correctIndex ? "correct" : ""}>
                                    {String.fromCharCode(65 + j)}) {opt}
                                  </li>
                                ))}
                              </ul>
                              <p className="qq-explain">{q.explanation}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── SCORM Export ────────────────── */}
                    <div className="export-section">
                      <button
                        className="export-action-btn scorm-btn"
                        disabled={exportingScorm}
                        onClick={async () => {
                          setExportingScorm(true);
                          try {
                            await downloadScormPackage({
                              title: learningIntent?.primaryGoal || "Learning Path",
                              courses,
                              studyGuide,
                              flashcards,
                              quickQuiz,
                            });
                          } catch (err) {
                            console.error("SCORM export failed:", err);
                          } finally {
                            setExportingScorm(false);
                          }
                        }}
                      >
                        {exportingScorm ? "⏳ Packaging..." : "📦 Download SCORM Package"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ip-empty">
                    <p>Add courses and set a goal to enable export.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
