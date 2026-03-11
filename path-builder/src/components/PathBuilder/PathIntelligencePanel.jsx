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
} from "../../services/studyGuideGenerator";
import { previewScormPackage } from "../../services/scormPackager";
import { exportScormPackage } from "../../services/scormExportService";
import { evaluateChecks } from "../../services/pathChecks";
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

// ── ExportPanel — consolidated sign-off, readiness, download, preview, publish ──
function ExportPanel({
  pathResult,
  analysis,
  courses,
  learningIntent: _learningIntent,
  studyGuide: _studyGuide,
  flashcards: _flashcards,
  exportingScorm,
  setExportingScorm,
}) {
  const [signedOff, setSignedOff] = useState(false);
  const [published, setPublished] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [scormExported, setScormExported] = useState(false);
  const [scormError, setScormError] = useState(null);

  const checks = useMemo(() => evaluateChecks(pathResult, analysis), [pathResult, analysis]);
  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;
  const allAutoChecksPassed = passedCount === totalCount;
  const readyToPublish = allAutoChecksPassed && signedOff;



  const handleDownload = async () => {
    setExportingScorm(true);
    setScormError(null);
    try {
      await exportScormPackage(pathResult, { includeQuiz: true });
      setScormExported(true);
    } catch (err) {
      console.error("SCORM export failed:", err);
      setScormError(err.message || "Export failed");
    } finally {
      setExportingScorm(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      // Enrich path steps with video data from courses before preview
      const enrichedResult = { ...pathResult };
      if (pathResult?.path && courses?.length) {

        enrichedResult.path = pathResult.path.map((step, i) => {
          const seg = step.segment || {};
          // Already has a usable video reference? Skip enrichment
          if (seg.videoUrl || seg.drive_id) return step;

          // Match step to course — try code first, then title substring
          const matchedCourse = courses.find(
            (c) =>
              (c.code && step.code && c.code === step.code) ||
              (c.title && step.title && c.title === step.title) ||
              (c.title && step.title && step.title.includes(c.title))
          );

          if (!matchedCourse) {
            console.debug(`[SCORM Preview] Step ${i} "${step.title?.slice(0, 40)}" — no course match. step.code=${step.code}`);
            return step;
          }

          // Extract video info from the matched course
          const firstVideo = matchedCourse.videos?.[0];
          const driveId = firstVideo?.drive_id || "";
          // Build a YouTube URL from drive_id or use the course _url
          const videoUrl = matchedCourse._url
            || (driveId ? `https://drive.google.com/file/d/${driveId}/view` : "")
            || "";

          console.debug(`[SCORM Preview] Step ${i} matched → "${matchedCourse.title?.slice(0, 40)}" videoUrl=${videoUrl.slice(0, 60)} drive_id=${driveId.slice(0, 20)}`);

          return {
            ...step,
            videos: step.videos || matchedCourse.videos,
            segment: {
              ...seg,
              videoUrl,
              drive_id: driveId,
              videoTitle: seg.videoTitle || firstVideo?.title || firstVideo?.name || matchedCourse.title || "",
            },
          };
        });
      } else {
        console.debug("[SCORM Preview] No enrichment — courses:", courses?.length, "path:", pathResult?.path?.length);
      }
      await previewScormPackage(enrichedResult);
    } catch (err) {
      console.error("Preview failed:", err);
    } finally {
      setPreviewing(false);
    }
  };

  const handlePublish = () => {
    if (!readyToPublish) return;
    setPublished(true);
  };

  return (
    <div className="export-panel">
      {/* ── Readiness Summary ── */}
      <div className="export-section" style={{ background: "rgba(88,166,255,0.05)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "0.75rem" }}>
        <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          📋 Readiness
        </h4>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "1.1rem" }}>{allAutoChecksPassed ? "✅" : "⚠️"}</span>
          <span style={{ fontSize: "0.9rem", color: allAutoChecksPassed ? "#3fb950" : "#d29922" }}>
            {passedCount}/{totalCount} auto-checks passed
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.1rem" }}>{signedOff ? "✅" : "⬜"}</span>
          <span style={{ fontSize: "0.9rem", color: signedOff ? "#3fb950" : "#8b949e" }}>
            Instructor sign-off
          </span>
        </div>
      </div>

      {/* ── Instructor Sign-off Toggle ── */}
      <div
        className="wizard-manual-toggle"
        onClick={() => setSignedOff(!signedOff)}
        role="switch"
        aria-checked={signedOff}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSignedOff(!signedOff);
          }
        }}
        id="instructor-signoff-toggle"
        style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: 8, cursor: "pointer", display: "flex", gap: "0.75rem", alignItems: "center", background: signedOff ? "rgba(63,185,80,0.08)" : "rgba(139,148,158,0.06)", border: `1px solid ${signedOff ? "#3fb95040" : "#30363d"}` }}
      >
        <div
          style={{ width: 36, height: 20, borderRadius: 10, background: signedOff ? "#3fb950" : "#484f58", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
        >
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: signedOff ? 18 : 2, transition: "left 0.2s" }} />
        </div>
        <div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#c9d1d9" }}>Instructor Sign-off</div>
          <div style={{ fontSize: "0.75rem", color: "#8b949e" }}>
            I've reviewed the path and confirm it meets quality standards
          </div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Preview */}
        <button
          className="export-action-btn"
          onClick={handlePreview}
          disabled={previewing}
          id="export-preview-btn"
          style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", color: "#fff", border: "none", padding: "0.6rem 1rem", borderRadius: 8, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, opacity: previewing ? 0.7 : 1, transition: "opacity 0.2s" }}
        >
          {previewing ? "⏳ Building preview..." : "👁️ Preview SCORM (Learner View)"}
        </button>

        {/* Download */}
        <button
          className="export-action-btn scorm-btn"
          onClick={handleDownload}
          disabled={exportingScorm}
          id="export-download-btn"
          style={{ background: scormExported ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", border: "none", padding: "0.6rem 1rem", borderRadius: 8, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, opacity: exportingScorm ? 0.7 : 1, transition: "all 0.2s" }}
        >
          {exportingScorm ? "⏳ Packaging..." : scormExported ? "✅ Downloaded!" : "📦 Download SCORM 1.2"}
        </button>

        {/* Publish */}
        {published ? (
          <div style={{ textAlign: "center", padding: "0.75rem", background: "rgba(63,185,80,0.1)", borderRadius: 8, color: "#3fb950", fontWeight: 600, fontSize: "0.9rem" }}>
            🎉 Path published successfully!
          </div>
        ) : (
          <>
            <button
              className="export-action-btn"
              onClick={handlePublish}
              disabled={!readyToPublish}
              id="export-publish-btn"
              style={{ background: readyToPublish ? "linear-gradient(135deg, #238636, #2ea043)" : "#21262d", color: readyToPublish ? "#fff" : "#484f58", border: readyToPublish ? "none" : "1px solid #30363d", padding: "0.6rem 1rem", borderRadius: 8, cursor: readyToPublish ? "pointer" : "not-allowed", fontSize: "0.85rem", fontWeight: 600, transition: "all 0.2s" }}
            >
              {readyToPublish ? "🚀 Publish Path" : "🔒 Publish Path"}
            </button>
            {!readyToPublish && (
              <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#8b949e", margin: "0.25rem 0 0" }}>
                {!allAutoChecksPassed ? "Pass all checks on the Review tab first" : "Toggle sign-off above to enable publishing"}
              </p>
            )}
          </>
        )}
      </div>

      {/* Error display */}
      {scormError && (
        <p style={{ textAlign: "center", fontSize: "0.8rem", color: "#f43f5e", marginTop: "0.5rem" }}>
          ❌ {scormError}
        </p>
      )}
    </div>
  );
}

// ── Tab definitions ──
const TABS = [
  { id: "coverage", icon: "📊", label: "Coverage" },
  { id: "gaps", icon: "⚠", label: "Gaps" },
  { id: "quiz", icon: "📚", label: "Study" },
  { id: "review", icon: "✅", label: "Review" },
  { id: "export", icon: "📦", label: "Export" },
];

// ── Workflow stage → visible tabs ──
const STAGE_TABS = {
  arrange:  ["coverage", "gaps"],
  review:   ["coverage", "gaps", "quiz", "review"],
  export:   ["quiz", "review", "export"],
};
const STAGE_DEFAULT_TAB = {
  arrange: "coverage",
  review:  "review",
  export:  "export",
};

// ── Main ───────────────────────────────────────────────────
export default function PathIntelligencePanel() {
  const { courses, learningIntent, setLearningIntent, pathStats, addCourse, workflowStage } = usePath();
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

  const [activeTab, setActiveTab] = useState(STAGE_DEFAULT_TAB[workflowStage] || "coverage");

  // Auto-select relevant tab when workflow stage changes
  useEffect(() => {
    const defaultTab = STAGE_DEFAULT_TAB[workflowStage];
    if (defaultTab) setActiveTab(defaultTab);
  }, [workflowStage]);

  // Filter visible tabs by workflow stage
  const visibleTabs = useMemo(() => {
    const allowed = STAGE_TABS[workflowStage];
    return allowed ? TABS.filter(t => allowed.includes(t.id)) : TABS;
  }, [workflowStage]);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [fillingGap, setFillingGap] = useState(null);
  const [fillResults, setFillResults] = useState({});
  const [quiz, setQuiz] = useState(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [studyGuide, setStudyGuide] = useState(null);
  const [flashcards, setFlashcards] = useState(null);
  const [exportingScorm, setExportingScorm] = useState(false);
  const [totalQuizQuestions, setTotalQuizQuestions] = useState(10);

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
      path: courses.map((c, i) => {
        const firstVideo = c.videos?.[0];
        const driveId = firstVideo?.drive_id || "";
        // Build a video URL from available data
        const videoUrl = c._url
          || c.url
          || (driveId ? `https://drive.google.com/file/d/${driveId}/view` : "")
          || "";
        return {
          code: c.code || "",
          category: c.role?.toLowerCase() === "prerequisite" ? "foundation" : "core",
          title: c.title || `Step ${i + 1}`,
          videos: c.videos,
          segment: {
            title: c.title || `Step ${i + 1}`,
            text: c.description || c.why || "",
            source: c.instructor || c.platform || "",
            type: c.type || "video",
            videoUrl,
            drive_id: driveId,
            videoTitle: firstVideo?.title || firstVideo?.name || c.title || "",
            startTime: c.startTime || firstVideo?.start_time || 0,
            endTime: c.endTime || firstVideo?.end_time || 0,
          },
        };
      }),
      bridges: [],
      gaps: analysis,
    };
  }, [isReady, courses, learningIntent, analysis]);

  // ── Analysis cache key ──
  const analysisKey = useMemo(() => {
    if (!isReady) return null;
    const codes = courses.map((c) => c.code || c.title).sort().join("|");
    return `ip-analysis-${learningIntent.primaryGoal}-${codes}`.replace(/\s+/g, "_").slice(0, 120);
  }, [isReady, courses, learningIntent?.primaryGoal]);

  // Restore cached analysis on mount / key change
  useEffect(() => {
    if (!analysisKey) return;
    try {
      const cached = localStorage.getItem(analysisKey);
      if (cached && !analysis) {
        setAnalysis(JSON.parse(cached));
      }
    } catch { /* ignore parse errors */ }
  }, [analysisKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Persist to localStorage
      if (analysisKey) {
        try { localStorage.setItem(analysisKey, JSON.stringify(result)); } catch { /* quota */ }
      }
    } catch (err) {
      setError(err.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [isReady, analyzing, courses, learningIntent, analysisKey]);

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
      const quizMap = await generateQuizForPath(pathResult.path, learningIntent.primaryGoal, totalQuizQuestions);
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
  }, [pathResult, generatingQuiz, learningIntent, totalQuizQuestions]);

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

          {/* Readiness Bar (Review + Export stages) */}
          {(workflowStage === "review" || workflowStage === "export") && pathResult && (() => {
            const checks = evaluateChecks(pathResult, analysis);
            const passed = checks.filter(c => c.passed).length;
            const total = checks.length;
            const allPassed = passed === total;
            const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
            return (
              <div
                className="ip-readiness-bar"
                onClick={() => setActiveTab("review")}
                role="button"
                tabIndex={0}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.5rem 0.75rem", borderRadius: 8, cursor: "pointer",
                  background: allPassed ? "rgba(63,185,80,0.08)" : "rgba(210,153,34,0.08)",
                  border: `1px solid ${allPassed ? "#3fb95040" : "#d2992240"}`,
                  marginBottom: "0.5rem", transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: "1rem" }}>{allPassed ? "✅" : "⚠️"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: allPassed ? "#3fb950" : "#d29922" }}>
                    {allPassed ? "Ready to Export" : `${passed}/${total} checks — Fix ${total - passed} issue${total - passed > 1 ? "s" : ""}`}
                  </div>
                  <div style={{
                    height: 4, borderRadius: 2, marginTop: 4,
                    background: "rgba(139,148,158,0.15)",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 2, transition: "width 0.3s",
                      width: `${pct}%`,
                      background: allPassed ? "#3fb950" : "#d29922",
                    }} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Tab Bar */}
          <div className="ip-tabs">
            {visibleTabs.map((tab) => (
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
                                        <div className="ip-fill-seg-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                          {seg.type === "transcript" && "🎥"}
                                          {seg.type === "docs" && "📄"}
                                          {seg.type === "epic_learning" && "🎓"}
                                          <span style={{ fontWeight: 600 }}>{seg.title}</span>
                                          {seg.type === "transcript" && seg.courseCode && (
                                            <span className="gap-fill-badge">{seg.courseCode}</span>
                                          )}
                                        </div>
                                        
                                        {seg.type === "transcript" && seg.videoTitle && seg.videoTitle !== seg.title && (
                                          <div className="ip-fill-seg-video" style={{ fontSize: "0.8rem", color: "var(--fg-muted)", marginTop: "2px" }}>
                                            From: <em>{seg.videoTitle}</em>
                                          </div>
                                        )}
                                        
                                        {seg.type === "transcript" && seg.startTimestamp && (
                                          <div className="ip-fill-seg-video" style={{ fontSize: "0.75rem", color: "var(--accent-fg)", marginTop: "2px", fontWeight: 500 }}>
                                            ⏱ {seg.startTimestamp} 
                                            {seg.endTimestamp ? ` - ${seg.endTimestamp}` : ""}
                                          </div>
                                        )}

                                        {seg.type === "docs" && seg.url && (
                                          <div style={{ fontSize: "0.75rem", color: "var(--accent-fg)", marginTop: "2px" }}>
                                            <a href={seg.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                                              🔗 View Documentation
                                            </a>
                                          </div>
                                        )}

                                        {seg.text && (
                                          <div className="ip-fill-seg-snippet" style={{fontSize: "0.8rem", color: "var(--fg-muted)", marginTop: "6px", marginBottom: "6px", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", fontStyle: "italic", borderLeft: "2px solid var(--border-muted)", paddingLeft: "8px"}}>
                                            "{seg.text}"
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

            {/* ════ STUDY TAB ════ */}
            {activeTab === "quiz" && (
              <div className="ip-tab-pane">
                <p className="ip-tab-desc">
                  Generate study materials and knowledge-checks from your path content.
                </p>

                {/* ── Study Guide ─────────────────── */}
                <div className="export-section" style={{ marginBottom: "16px" }}>
                  <button
                    className="export-action-btn study-btn"
                    onClick={() => {
                      const guide = buildContentSummary(courses, getCourseSummary);
                      enrichGuideWithBloom(guide);
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
                                title={`Bloom's Taxonomy: ${s.bloom.level}`}
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
                <div className="export-section" style={{ marginBottom: "16px" }}>
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

                {/* ── Deep Quiz (AI Generated) ────── */}
                <div className="export-section">
                  <h4 style={{ marginBottom: 8, fontSize: "0.85rem", color: "var(--fg-muted)" }}>Path-Specific AI Quiz</h4>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: "0.8rem" }}>
                  <label htmlFor="quiz-total-questions">Total questions:</label>
                  <input
                    id="quiz-total-questions"
                    type="number"
                    min={1}
                    max={20}
                    value={totalQuizQuestions}
                    onChange={(e) => setTotalQuizQuestions(Math.max(1, Math.min(20, +e.target.value || 10)))}
                    style={{ width: 48, textAlign: "center", padding: "2px 4px", borderRadius: 4, border: "1px solid var(--border, #30363d)", background: "var(--bg-secondary, #161b22)", color: "inherit" }}
                  />
                </div>
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
              </div>
            )}

            {/* ════ REVIEW TAB ════ */}
            {activeTab === "review" && (
              <div className="ip-tab-pane">
                {pathResult ? (
                  <PathWizard
                    pathResult={pathResult}
                    gaps={analysis}
                    onFixClick={(checkId) => {
                      // Content checks → switch to Gaps tab where Fill actions live
                      const contentChecks = ["has-prerequisites", "has-core", "has-practice", "no-high-gaps", "coverage-threshold"];
                      if (contentChecks.includes(checkId)) {
                        setActiveTab("gaps");
                        // Scroll the tab pane to the top so user sees the Gaps content
                        requestAnimationFrame(() => {
                          const pane = document.querySelector(".ip-tab-pane");
                          if (pane) pane.scrollTop = 0;
                          // Flash the Gaps tab button briefly
                          const gapsBtn = document.querySelector('.ip-tab.active');
                          if (gapsBtn) {
                            gapsBtn.style.transition = "background 0.3s";
                            gapsBtn.style.background = "rgba(245, 158, 11, 0.25)";
                            setTimeout(() => { gapsBtn.style.background = ""; }, 800);
                          }
                        });
                      }
                      // Structural checks → just show a hint (no auto-action)
                      const structureChecks = ["step-count", "video-duration", "has-bridges"];
                      if (structureChecks.includes(checkId)) {
                        // Scroll to the relevant step in the step list
                        const stepList = document.querySelector(".ip-step-list, .path-steps");
                        if (stepList) stepList.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }}
                  />
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
                  <ExportPanel
                    pathResult={pathResult}
                    analysis={analysis}
                    courses={courses}
                    learningIntent={learningIntent}
                    studyGuide={studyGuide}
                    flashcards={flashcards}
                    exportingScorm={exportingScorm}
                    setExportingScorm={setExportingScorm}
                  />
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
