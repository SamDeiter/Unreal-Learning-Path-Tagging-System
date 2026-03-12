/**
 * LearnerView.jsx — Unified V2 Learner Path Renderer
 *
 * Renders a LearningPathV2 object using the structured layout:
 *   - PathIntro (quick answer, root cause, learning outcomes)
 *   - Sections with authored labels and purposes
 *   - LessonCards with learn/do/check/apply structure
 *   - Progress tracking via localStorage
 *
 * Supports two rendering modes:
 *   1. Overview mode (default): all sections + cards visible, scrollable
 *   2. Focused-step mode: one card at a time with prev/next navigation
 *      (used by WebPlayerPreview after "Begin Learning")
 *
 * Props for focused-step mode:
 *   - focusedStepIndex (number | null): when set, highlight this step
 *   - onStepChange(index): callback when user navigates
 *   - onComplete(): callback when final step is completed
 *   - showIntro (boolean): whether to show PathIntro
 *   - externalProgress (Set | null): parent-managed progress state
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

export default function LearnerView({
  v2Path,
  focusedStepIndex = null,
  onStepChange,
  onComplete,
  showIntro = true,
  externalProgress = null,
}) {
  const [completedSteps, setCompletedSteps] = useState({});
  const focusedRef = useRef(null);

  const isFocusedMode = focusedStepIndex !== null && focusedStepIndex !== undefined;

  // ── Load progress from localStorage ──
  useEffect(() => {
    if (!v2Path || externalProgress) return;
    const key = getProgressKey(v2Path);
    try {
      const saved = localStorage.getItem(key);
      if (saved) setCompletedSteps(JSON.parse(saved));
    } catch { /* ignore corrupt data */ }
  }, [v2Path, externalProgress]);

  // ── Save progress ──
  const saveProgress = useCallback((updated) => {
    if (!v2Path || externalProgress) return;
    const key = getProgressKey(v2Path);
    try {
      localStorage.setItem(key, JSON.stringify(updated));
    } catch { /* quota full, ignore */ }
  }, [v2Path, externalProgress]);

  const toggleComplete = useCallback((globalIndex) => {
    if (externalProgress) return; // parent manages progress
    setCompletedSteps((prev) => {
      const updated = { ...prev, [globalIndex]: !prev[globalIndex] };
      saveProgress(updated);
      return updated;
    });
  }, [saveProgress, externalProgress]);

  // Scroll focused card into view when it changes
  useEffect(() => {
    if (isFocusedMode && focusedRef.current) {
      focusedRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusedStepIndex, isFocusedMode]);

  // ── Flatten steps for global index mapping ──
  const flatSteps = useMemo(() => {
    const result = [];
    if (!v2Path?.sections) return result;
    for (const section of v2Path.sections) {
      if (!section.steps?.length) continue;
      for (const step of section.steps) {
        result.push({ step, section });
      }
    }
    return result;
  }, [v2Path]);

  if (!v2Path || !v2Path.sections) return null;

  // ── Calculate progress ──
  const totalSteps = flatSteps.length;
  const completedCount = externalProgress
    ? externalProgress.size
    : Object.values(completedSteps).filter(Boolean).length;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  // ── Build section-grouped structure with globalIndex ──
  let globalCounter = 0;

  return (
    <div className={`learner-view ${isFocusedMode ? "learner-view--focused" : ""}`}>
      {/* Path Intro */}
      {showIntro && <PathIntro v2Path={v2Path} />}

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
              const idx = globalCounter++;
              const isFocused = isFocusedMode && idx === focusedStepIndex;
              const isDimmed = isFocusedMode && idx !== focusedStepIndex;
              const isStepCompleted = externalProgress
                ? externalProgress.has(idx)
                : !!completedSteps[idx];

              return (
                <div
                  key={step.id || idx}
                  className={isDimmed ? "lesson-card--dimmed" : ""}
                >
                  <LessonCard
                    ref={isFocused ? focusedRef : undefined}
                    step={step}
                    index={idx}
                    isCompleted={isStepCompleted}
                    onToggleComplete={toggleComplete}
                    isFocused={isFocused}
                  />
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ── Navigation bar (focused mode only) ── */}
      {isFocusedMode && (
        <div className="learner-view__nav-bar">
          <button
            className="learner-view__nav-btn learner-view__nav-btn--prev"
            onClick={() => onStepChange?.(focusedStepIndex - 1)}
            disabled={focusedStepIndex <= 0}
          >
            ← Previous
          </button>
          <span className="learner-view__nav-position">
            Step {focusedStepIndex + 1} of {totalSteps}
          </span>
          <button
            className="learner-view__nav-btn learner-view__nav-btn--next"
            onClick={() => {
              if (focusedStepIndex >= totalSteps - 1) {
                onComplete?.();
              } else {
                onStepChange?.(focusedStepIndex + 1);
              }
            }}
          >
            {focusedStepIndex >= totalSteps - 1
              ? "✅ Complete & Take Quiz →"
              : "Complete & Continue →"}
          </button>
        </div>
      )}

      {/* Completion message */}
      {progressPct === 100 && (
        <div className="learner-view__complete">
          🎉 <strong>Path complete!</strong> You finished all {totalSteps} steps.
        </div>
      )}
    </div>
  );
}
