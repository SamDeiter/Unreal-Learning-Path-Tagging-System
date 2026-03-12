/**
 * LearnerView.jsx — Unified V2 Learner Path Renderer
 *
 * Renders a LearningPathV2 object using the structured layout:
 *   - PathIntro (quick answer, root cause, learning outcomes)
 *   - Sections with authored labels and purposes
 *   - LessonCards with learn/do/check/apply structure
 *   - Progress tracking via localStorage
 *
 * This component replaces heuristic section grouping with
 * explicit authored sections from the V2 path data.
 */

import { useState, useEffect, useCallback } from "react";
import PathIntro from "./PathIntro";
import LessonCard from "./LessonCard";
import { SECTION_LABELS } from "../../schemas/LearningPathV2";
import "./LearnerView.css";

/**
 * Generate a stable key for localStorage progress tracking.
 */
function getProgressKey(v2Path) {
  const title = (v2Path?.title || "").slice(0, 40).replace(/\s+/g, "_");
  return `learnerProgress_${title}_${v2Path?.generatedAt || ""}`;
}

export default function LearnerView({ v2Path }) {
  const [completedSteps, setCompletedSteps] = useState({});

  // ── Load progress from localStorage ──
  useEffect(() => {
    if (!v2Path) return;
    const key = getProgressKey(v2Path);
    try {
      const saved = localStorage.getItem(key);
      if (saved) setCompletedSteps(JSON.parse(saved));
    } catch { /* ignore corrupt data */ }
  }, [v2Path]);

  // ── Save progress ──
  const saveProgress = useCallback((updated) => {
    if (!v2Path) return;
    const key = getProgressKey(v2Path);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch { /* quota full, ignore */ }
  }, [v2Path]);

  const toggleComplete = useCallback((globalIndex) => {
    setCompletedSteps((prev) => {
      const updated = { ...prev, [globalIndex]: !prev[globalIndex] };
      saveProgress(updated);
      return updated;
    });
  }, [saveProgress]);

  if (!v2Path || !v2Path.sections) return null;

  // ── Calculate progress ──
  const totalSteps = v2Path.sections.reduce(
    (sum, s) => sum + (s.steps?.length || 0), 0
  );
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  // ── Build global index for each step ──
  let globalIndex = 0;

  return (
    <div className="learner-view">
      {/* Path Intro */}
      <PathIntro v2Path={v2Path} />

      {/* Progress Bar */}
      {totalSteps > 0 && (
        <div className="learner-view__progress">
          <div className="learner-view__progress-bar">
            <div
              className="learner-view__progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="learner-view__progress-text">
            {completedCount}/{totalSteps} steps · {progressPct}% complete
          </span>
        </div>
      )}

      {/* Sections */}
      {v2Path.sections.map((section) => {
        if (!section.steps?.length) return null;

        return (
          <div key={section.id} className="learner-view__section">
            <div className="learner-view__section-header">
              <h3 className="learner-view__section-title">
                {section.title || SECTION_LABELS[section.phase] || section.phase}
              </h3>
              {section.purpose && (
                <p className="learner-view__section-purpose">{section.purpose}</p>
              )}
            </div>

            {section.steps.map((step) => {
              const idx = globalIndex++;
              return (
                <LessonCard
                  key={step.id || idx}
                  step={step}
                  index={idx}
                  isCompleted={!!completedSteps[idx]}
                  onToggleComplete={toggleComplete}
                />
              );
            })}
          </div>
        );
      })}

      {/* Completion message */}
      {progressPct === 100 && (
        <div className="learner-view__complete">
          🎉 <strong>Path complete!</strong> You finished all {totalSteps} steps.
        </div>
      )}
    </div>
  );
}
