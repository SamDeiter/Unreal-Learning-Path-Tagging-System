/**
 * PathIntro.jsx — Phase 6: Learner-Facing Path Introduction
 *
 * Renders the top-of-path intro so learners immediately understand:
 *   - What they'll solve
 *   - Most likely root cause
 *   - Quick fix to try now
 *   - What they'll learn
 *   - Estimated time, difficulty, prerequisites
 */

import "./PathIntro.css";

const DIFFICULTY_COLORS = {
  beginner: { bg: "#a6e3a1", label: "Beginner" },
  intermediate: { bg: "#89b4fa", label: "Intermediate" },
  advanced: { bg: "#fab387", label: "Advanced" },
};

export default function PathIntro({ v2Path }) {
  if (!v2Path) return null;

  const diff = DIFFICULTY_COLORS[v2Path.difficulty] || DIFFICULTY_COLORS.intermediate;

  return (
    <div className="path-intro">
      {/* Title */}
      <h2 className="path-intro__title">{v2Path.title}</h2>

      {/* Quick Answer */}
      {v2Path.quickAnswer && (
        <div className="path-intro__quick-answer">
          <span className="path-intro__label">💡 Quick Answer</span>
          <p>{v2Path.quickAnswer}</p>
        </div>
      )}

      {/* Root Cause */}
      {v2Path.rootCause && (
        <div className="path-intro__root-cause">
          <span className="path-intro__label">🔍 Root Cause</span>
          <p>{v2Path.rootCause}</p>
        </div>
      )}

      {/* Quick Win */}
      {v2Path.quickWin && (
        <div className="path-intro__quick-win">
          <span className="path-intro__label">⚡ Try This First</span>
          <p>{v2Path.quickWin}</p>
        </div>
      )}

      {/* Meta badges */}
      <div className="path-intro__meta">
        <span
          className="path-intro__badge"
          style={{ background: diff.bg, color: "#1e1e2e" }}
        >
          {diff.label}
        </span>
        {v2Path.estimatedMinutes > 0 && (
          <span className="path-intro__badge path-intro__badge--time">
            ⏱ {v2Path.estimatedMinutes} min
          </span>
        )}
        {v2Path.sections && (
          <span className="path-intro__badge path-intro__badge--steps">
            📋 {v2Path.sections.reduce((sum, s) => sum + (s.steps?.length || 0), 0)} steps
          </span>
        )}
      </div>

      {/* What You'll Learn */}
      {v2Path.whatYouWillLearn?.length > 0 && (
        <div className="path-intro__outcomes">
          <span className="path-intro__label">📚 What You'll Learn</span>
          <ul>
            {v2Path.whatYouWillLearn.map((outcome, i) => (
              <li key={i}>{outcome}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Prerequisites */}
      {v2Path.prerequisites?.length > 0 && (
        <div className="path-intro__prereqs">
          <span className="path-intro__label">📝 Prerequisites</span>
          <ul>
            {v2Path.prerequisites.map((prereq, i) => (
              <li key={i}>{prereq}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
