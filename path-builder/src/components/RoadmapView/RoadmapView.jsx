/**
 * RoadmapView.jsx — Goal-First Learning Roadmap UI
 *
 * Renders a milestone-based roadmap for broad learner goals.
 * Each milestone is an expandable card that shows goal, rationale,
 * and a bespoke micro-path (rendered via LearnerView).
 */

import { useState, useMemo, useCallback } from "react";
import LearnerView from "../LearnerView/LearnerView";
import "./RoadmapView.css";

// ── Phase icons ─────────────────────────────────────────────────────

const PHASE_ICONS = {
  "start here": "🏁",
  "first playable": "🎮",
  "core game loop": "🔄",
  "build the loop": "🔄",
  "feedback": "💬",
  "ship it": "📦",
  "package": "📦",
  "polish": "✨",
};

function getPhaseIcon(phase) {
  const key = (phase || "").toLowerCase();
  return PHASE_ICONS[key] || "📍";
}

// ── Difficulty badges ───────────────────────────────────────────────

const DIFFICULTY_COLORS = {
  beginner: "roadmap-diff--beginner",
  intermediate: "roadmap-diff--intermediate",
  advanced: "roadmap-diff--advanced",
};

// ── Coverage badge ──────────────────────────────────────────────────

function CoverageBadge({ coverage }) {
  if (!coverage) return null;
  const statusMap = {
    good: { icon: "✅", label: "Good coverage", cls: "roadmap-cov--good" },
    partial: { icon: "⚠️", label: "Partial coverage", cls: "roadmap-cov--partial" },
    weak: { icon: "🔶", label: "AI-supplemented", cls: "roadmap-cov--weak" },
    pending: { icon: "⏳", label: "Loading...", cls: "roadmap-cov--pending" },
    error: { icon: "❌", label: "Failed to load", cls: "roadmap-cov--error" },
  };
  const { icon, label, cls } = statusMap[coverage.status] || statusMap.pending;
  return <span className={`roadmap-cov ${cls}`} title={label}>{icon} {label}</span>;
}

// ── Main Component ──────────────────────────────────────────────────

export default function RoadmapView({ roadmapResult, onClose }) {
  const [expandedMilestone, setExpandedMilestone] = useState(null);
  const [completedMilestones, setCompletedMilestones] = useState(new Set());

  const milestones = roadmapResult?.roadmap || [];
  const title = roadmapResult?.title || "Learning Roadmap";
  const learnerLevel = roadmapResult?.learnerLevel || "beginner";

  const progressPct = useMemo(() => {
    if (milestones.length === 0) return 0;
    return Math.round((completedMilestones.size / milestones.length) * 100);
  }, [milestones.length, completedMilestones]);

  const toggleMilestone = useCallback((index) => {
    setExpandedMilestone((prev) => (prev === index ? null : index));
  }, []);

  const markComplete = useCallback((index) => {
    setCompletedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  return (
    <div className="roadmap-container">
      {/* ── Header ── */}
      <div className="roadmap-header">
        <div className="roadmap-header-top">
          <h1 className="roadmap-title">{title}</h1>
          {onClose && (
            <button className="roadmap-close" onClick={onClose} title="Close roadmap">✕</button>
          )}
        </div>
        <div className="roadmap-meta">
          <span className="roadmap-level">📊 {learnerLevel}</span>
          <span className="roadmap-count">📋 {milestones.length} milestones</span>
          <span className="roadmap-progress-text">{progressPct}% complete</span>
        </div>
        <div className="roadmap-progress-bar">
          <div className="roadmap-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* ── Milestone Timeline ── */}
      <div className="roadmap-timeline">
        {milestones.map((milestone, index) => {
          const isExpanded = expandedMilestone === index;
          const isComplete = completedMilestones.has(index);
          const hasMicroPath = milestone.microPath?.v2Path || milestone.microPath?.path?.length > 0;

          return (
            <div
              key={index}
              className={`roadmap-milestone ${isExpanded ? "roadmap-milestone--expanded" : ""} ${isComplete ? "roadmap-milestone--complete" : ""}`}
            >
              {/* Timeline connector */}
              {index > 0 && <div className="roadmap-connector" />}

              {/* Milestone card */}
              <div className="roadmap-card" onClick={() => toggleMilestone(index)}>
                <div className="roadmap-card-header">
                  <div className="roadmap-card-left">
                    <span className="roadmap-phase-icon">{getPhaseIcon(milestone.phase)}</span>
                    <div className="roadmap-card-info">
                      <span className="roadmap-phase-label">{milestone.phase}</span>
                      <h3 className="roadmap-card-title">{milestone.title}</h3>
                    </div>
                  </div>
                  <div className="roadmap-card-right">
                    <span className={`roadmap-diff ${DIFFICULTY_COLORS[milestone.difficulty] || ""}`}>
                      {milestone.difficulty}
                    </span>
                    <CoverageBadge coverage={milestone.coverage} />
                    <button
                      className={`roadmap-check ${isComplete ? "roadmap-check--done" : ""}`}
                      onClick={(e) => { e.stopPropagation(); markComplete(index); }}
                      title={isComplete ? "Mark incomplete" : "Mark complete"}
                    >
                      {isComplete ? "✅" : "⬜"}
                    </button>
                    <span className="roadmap-expand">{isExpanded ? "▾" : "▸"}</span>
                  </div>
                </div>

                {/* Goal & rationale (always visible) */}
                <p className="roadmap-card-goal">{milestone.learnerGoal || milestone.goal}</p>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="roadmap-expanded">
                  <div className="roadmap-details">
                    <div className="roadmap-detail">
                      <strong>💡 Why now:</strong> {milestone.rationale}
                    </div>
                    <div className="roadmap-detail">
                      <strong>✅ Done when:</strong> {milestone.completionCheck}
                    </div>
                    {milestone.coverage?.totalSteps > 0 && (
                      <div className="roadmap-detail">
                        <strong>📊 Content:</strong> {milestone.coverage.corpusSteps} corpus steps, {milestone.coverage.totalSteps - milestone.coverage.corpusSteps} AI-generated
                      </div>
                    )}
                  </div>

                  {/* Micro-path */}
                  {hasMicroPath && milestone.microPath.v2Path ? (
                    <div className="roadmap-micropath">
                      <LearnerView v2Path={milestone.microPath.v2Path} />
                    </div>
                  ) : milestone.microPath?.path?.length > 0 ? (
                    <div className="roadmap-micropath roadmap-micropath--legacy">
                      <h4>📝 Steps ({milestone.microPath.path.length})</h4>
                      <ol className="roadmap-step-list">
                        {milestone.microPath.path.map((step, si) => (
                          <li key={si} className="roadmap-step-item">
                            <strong>{step.title}</strong>
                            {step.summary && <p>{step.summary}</p>}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : milestone.coverage?.status === "pending" ? (
                    <div className="roadmap-loading">
                      <div className="roadmap-spinner" />
                      <p>Loading learning content...</p>
                    </div>
                  ) : (
                    <div className="roadmap-empty">
                      <p>No micro-path available. Try searching for: <em>{milestone.searchQuery}</em></p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      {roadmapResult?.nextBestAction && (
        <div className="roadmap-footer">
          <p className="roadmap-next-action">
            <strong>💡 Next step:</strong> {roadmapResult.nextBestAction}
          </p>
        </div>
      )}
    </div>
  );
}
