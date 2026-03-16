/**
 * EffectivenessReport.jsx — Path Completion Analysis
 *
 * Displayed at the COMPLETE stage to show the learner how effective
 * the path was at solving their original problem. Replaces the
 * generic "path complete" screen with evidence-based results.
 *
 * Shows:
 *   - Problem recap
 *   - Module verdict summary (pass/struggle/irrelevant/skipped)
 *   - Confidence journey (before → after per module)
 *   - Quiz performance
 *   - Replanning decisions made during the session
 *   - Final resolution assessment
 */

import { useState } from "react";
import { summarizeCheckpoints } from "../../services/checkpointService";
import "./EffectivenessReport.css";

// ── Verdict UI Config ──────────────────────────────────────────────
const VERDICT_CONFIG = {
  pass: { emoji: "✅", label: "Passed", color: "#3fb950" },
  struggle: { emoji: "🔧", label: "Struggled", color: "#d29922" },
  irrelevant: { emoji: "⏭️", label: "Not relevant", color: "#8b949e" },
  skipped: { emoji: "⏩", label: "Skipped", color: "#6e7681" },
};

export default function EffectivenessReport({
  checkpoints,
  replanHistory,
  originalProblem,
  pathTitle,
  onFinish,
}) {
  const [resolved, setResolved] = useState(null);
  const summary = summarizeCheckpoints(checkpoints || []);

  return (
    <div className="effectiveness-report">
      {/* Header */}
      <div className="report-header">
        <span className="report-badge">📊 Path Effectiveness Report</span>
        <h1>{pathTitle || "Learning Path Complete"}</h1>
        {originalProblem && (
          <p className="report-problem">
            <strong>Original question:</strong> {originalProblem}
          </p>
        )}
      </div>

      {/* Summary Stats */}
      <div className="report-stats">
        <div className="stat-card">
          <span className="stat-value">{summary.total}</span>
          <span className="stat-label">Modules Completed</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{summary.counts.pass}</span>
          <span className="stat-label">Passed</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {summary.quizAccuracy !== null
              ? `${Math.round(summary.quizAccuracy * 100)}%`
              : "N/A"}
          </span>
          <span className="stat-label">Quiz Accuracy</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{summary.overallEffectiveness}</span>
          <span className="stat-label">Effectiveness</span>
        </div>
      </div>

      {/* Module Results */}
      {checkpoints && checkpoints.length > 0 && (
        <div className="report-section">
          <h2>Module Results</h2>
          <div className="module-results">
            {checkpoints.map((cp, i) => {
              const v = VERDICT_CONFIG[cp.verdict] || VERDICT_CONFIG.skipped;
              return (
                <div key={i} className="module-result-row">
                  <span className="module-result-name">{cp.moduleId}</span>
                  <span className="module-result-verdict" style={{ color: v.color }}>
                    {v.emoji} {v.label}
                  </span>
                  <span className="module-result-confidence">
                    {cp.confidenceBefore > 0 && (
                      <>
                        {cp.confidenceBefore} → {cp.confidenceAfter}
                        {cp.confidenceAfter > cp.confidenceBefore && " 📈"}
                        {cp.confidenceAfter < cp.confidenceBefore && " 📉"}
                        {cp.confidenceAfter === cp.confidenceBefore && " ➡️"}
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confidence Journey */}
      {summary.confidenceJourney.length > 0 && (
        <div className="report-section">
          <h2>Confidence Journey</h2>
          <div className="confidence-chart">
            {summary.confidenceJourney.map((point, i) => (
              <div key={i} className="confidence-bar-group">
                <div className="confidence-bars">
                  <div
                    className="confidence-bar before"
                    style={{ height: `${point.before * 20}%` }}
                    title={`Before: ${point.before}/5`}
                  />
                  <div
                    className="confidence-bar after"
                    style={{ height: `${point.after * 20}%` }}
                    title={`After: ${point.after}/5`}
                  />
                </div>
                <span className="confidence-module-label">M{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="confidence-legend">
            <span className="legend-item"><span className="legend-dot before" /> Before</span>
            <span className="legend-item"><span className="legend-dot after" /> After</span>
          </div>
        </div>
      )}

      {/* Path Adaptations */}
      {replanHistory && replanHistory.length > 0 && (
        <div className="report-section">
          <h2>Path Adaptations</h2>
          <div className="replan-timeline">
            {replanHistory.map((entry, i) => (
              <div key={i} className="replan-entry">
                <span className="replan-action">{entry.action}</span>
                <span className="replan-reason">{entry.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Resolution */}
      <div className="report-section report-resolution">
        <h2>Did this path solve your original problem?</h2>
        <div className="resolution-options">
          {[
            { value: "yes", label: "✅ Yes — problem resolved" },
            { value: "partially", label: "🔶 Partially — closer but not fully" },
            { value: "no", label: "❌ No — still stuck" },
          ].map(({ value, label }) => (
            <button
              key={value}
              className={`resolution-btn ${resolved === value ? "active" : ""}`}
              onClick={() => setResolved(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Finish */}
      <div className="report-actions">
        <button className="report-finish-btn" onClick={onFinish}>
          {resolved ? "Finish & Save Results" : "Close Report"}
        </button>
      </div>
    </div>
  );
}
