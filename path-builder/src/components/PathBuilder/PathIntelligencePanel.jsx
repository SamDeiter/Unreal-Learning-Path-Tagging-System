/**
 * PathIntelligencePanel — Right-sidebar intelligence panel for Path Builder
 *
 * Replaces the old OutputPanel with a two-section layout:
 * 1. TOP: Path intelligence (coverage gauge, gap summary, quick actions)
 * 2. BOTTOM: Blueprint tabs (Outline, Objectives, Goals, Docs) — the old OutputPanel
 *
 * Gap analysis runs on-demand when user clicks "Analyze Path".
 */

import { useState, useCallback, useMemo } from "react";
import { usePath } from "../../context/PathContext";
import { analyzePathGaps } from "../../services/pathGapAnalyzer";
import { exportScormPackage } from "../../services/scormExportService";
import OutputPanel from "../OutputPanel/OutputPanel";
import "./PathIntelligencePanel.css";

// ── Coverage Gauge SVG ─────────────────────────────────────────────
function CoverageGauge({ score }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circumference - (pct / 100) * circumference;

  // Color by score
  const color = pct >= 80 ? "#3fb950" : pct >= 50 ? "#d29922" : pct >= 1 ? "#f85149" : "#484f58";

  return (
    <div className="coverage-gauge">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} className="gauge-bg" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          className="gauge-fill"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="gauge-label" style={{ color }}>
        {pct}%<small>coverage</small>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────
export default function PathIntelligencePanel() {
  const { courses, learningIntent, pathStats } = usePath();

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);

  // SCORM state
  const [scormExporting, setScormExporting] = useState(false);
  const [scormExported, setScormExported] = useState(false);
  const [scormError, setScormError] = useState(null);

  const hasCourses = courses.length > 0;

  // Build a pathResult-like object from PathContext for gap analysis / SCORM
  const pathResult = useMemo(() => {
    if (!hasCourses) return null;
    return {
      query: learningIntent?.primaryGoal || "Manual Learning Path",
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
      gaps: analysisResult,
    };
  }, [hasCourses, courses, learningIntent, analysisResult]);

  // ── Analyze Path ──
  const handleAnalyze = useCallback(async () => {
    if (!hasCourses || analyzing) return;
    setAnalyzing(true);
    setAnalyzeError(null);

    try {
      const query = learningIntent?.primaryGoal || courses.map((c) => c.title).join(", ");
      const result = await analyzePathGaps(
        courses.map((c) => ({
          category: c.role?.toLowerCase() === "prerequisite" ? "foundation" : "core",
          segment: {
            title: c.title || "Untitled",
            text: c.description || c.why || "",
          },
        })),
        query
      );
      setAnalysisResult(result);
    } catch (err) {
      setAnalyzeError(err.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [hasCourses, analyzing, courses, learningIntent]);

  // ── SCORM Export ──
  const handleScormExport = useCallback(async () => {
    if (!pathResult || scormExporting) return;
    setScormExporting(true);
    setScormError(null);

    try {
      await exportScormPackage(pathResult, { includeQuiz: true });
      setScormExported(true);
    } catch (err) {
      setScormError(err.message || "Export failed");
    } finally {
      setScormExporting(false);
    }
  }, [pathResult, scormExporting]);

  // ── Derived data ──
  const coverageScore = analysisResult?.coverageScore ?? 0;
  const blindSpots = analysisResult?.blindSpots || [];
  const prereqs = analysisResult?.prereqChain || [];

  // ── Render ──
  return (
    <div className="intel-panel">
      {/* Intelligence Header */}
      <div className="intel-header">
        <h3>🧠 Path Intelligence</h3>

        {!hasCourses ? (
          <div className="intel-empty-state">
            <span className="empty-icon">📊</span>
            <p>Add courses to your path to unlock intelligence features</p>
          </div>
        ) : (
          <>
            {/* Coverage Gauge + Stats */}
            <div className="intel-coverage-row">
              <CoverageGauge score={coverageScore} />
              <div className="coverage-meta">
                <div className="meta-stat">
                  <span>Courses</span>
                  <span>{pathStats.courseCount}</span>
                </div>
                <div className="meta-stat">
                  <span>Est. Time</span>
                  <span>{pathStats.estimatedHours}h</span>
                </div>
                <div className="meta-stat">
                  <span>Blind Spots</span>
                  <span>{blindSpots.length}</span>
                </div>
                {pathStats.levelRange && (
                  <div className="meta-stat">
                    <span>Levels</span>
                    <span>{pathStats.levelRange}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Gap Summary Chips */}
            {analysisResult && (
              <div className="intel-gap-summary">
                {coverageScore >= 80 ? (
                  <span className="gap-chip success">✅ Good Coverage</span>
                ) : coverageScore >= 50 ? (
                  <span className="gap-chip warning">⚠ Partial Coverage</span>
                ) : coverageScore >= 1 ? (
                  <span className="gap-chip">❌ Low Coverage</span>
                ) : null}
                {blindSpots.length > 0 && (
                  <span className="gap-chip warning">
                    {blindSpots.length} blind spot{blindSpots.length > 1 ? "s" : ""}
                  </span>
                )}
                {prereqs.length > 0 && (
                  <span className="gap-chip info">
                    {prereqs.length} prerequisite{prereqs.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="intel-actions">
              <button
                className="intel-action-btn analyze-btn"
                onClick={handleAnalyze}
                disabled={analyzing || !hasCourses}
              >
                {analyzing ? (
                  <>
                    <span className="intel-spinner" /> Analyzing...
                  </>
                ) : analysisResult ? (
                  "🔄 Re-Analyze Path"
                ) : (
                  "🔍 Analyze Path"
                )}
              </button>

              <button
                className={`intel-action-btn scorm-btn ${scormExported ? "exported" : ""}`}
                onClick={handleScormExport}
                disabled={scormExporting || !hasCourses}
              >
                {scormExporting
                  ? "⏳ Generating..."
                  : scormExported
                    ? "✅ Downloaded!"
                    : "📦 SCORM 1.2"}
              </button>

              <button className="intel-action-btn" disabled>
                📝 Add Quiz
              </button>
            </div>

            {scormError && <div className="scorm-error">❌ {scormError}</div>}
            {analyzeError && <div className="scorm-error">❌ {analyzeError}</div>}

            {/* Analysis Results — expanded view */}
            {analysisResult && blindSpots.length > 0 && (
              <div className="intel-analysis-results">
                <h4>Blind Spots</h4>
                <ul className="blind-spot-list">
                  {blindSpots.slice(0, 5).map((spot, i) => (
                    <li key={i}>{spot}</li>
                  ))}
                </ul>

                {prereqs.length > 0 && (
                  <>
                    <h4>Prerequisites</h4>
                    <div className="prereq-mini">
                      {prereqs.slice(0, 4).map((p, i) => (
                        <span key={i}>
                          {i > 0 && <span className="prereq-arrow"> → </span>}
                          <span className="prereq-node">{p}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Divider */}
      <div className="intel-divider" />

      {/* Blueprint Section — existing OutputPanel */}
      <div className="intel-blueprint">
        <OutputPanel />
      </div>
    </div>
  );
}
