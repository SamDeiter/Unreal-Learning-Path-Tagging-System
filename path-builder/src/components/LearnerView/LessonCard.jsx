/**
 * LessonCard.jsx — Phase 5: Structured Lesson Card
 *
 * Renders a single learning path step in a consistent teaching layout:
 *   - Why This Matters
 *   - Do This Now (whatToDo actions)
 *   - Check It Worked (howToVerify)
 *   - Common Mistake
 *   - Key Takeaway
 *   - Go Deeper (links)
 *
 * Replaces the single-summary-paragraph rendering with a structured
 * learn/do/check/apply layout based on research principles.
 */

import { useState } from "react";
import "./LessonCard.css";

// ── Completion type badges ─────────────────────────────────────────
const COMPLETION_BADGES = {
  read: { icon: "📖", label: "Read" },
  watch: { icon: "🎬", label: "Watch" },
  do: { icon: "🔧", label: "Do" },
  verify: { icon: "✅", label: "Verify" },
  apply: { icon: "🚀", label: "Apply" },
};

export default function LessonCard({ step, index, isCompleted, onToggleComplete }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!step) return null;

  const badge = COMPLETION_BADGES[step.completionType] || COMPLETION_BADGES.do;
  const hasStructuredContent = step.whatToDo?.length > 0 || step.howToVerify?.length > 0;

  return (
    <div className={`lesson-card ${isCompleted ? "lesson-card--completed" : ""}`}>
      {/* ── Header ── */}
      <div className="lesson-card__header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="lesson-card__header-left">
          <button
            className="lesson-card__checkbox"
            onClick={(e) => { e.stopPropagation(); onToggleComplete?.(index); }}
            aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
          >
            {isCompleted ? "✅" : "⬜"}
          </button>
          <span className="lesson-card__number">{index + 1}</span>
          <h3 className="lesson-card__title">{step.title}</h3>
        </div>
        <div className="lesson-card__header-right">
          <span className="lesson-card__badge" title={badge.label}>
            {badge.icon} {badge.label}
          </span>
          {step.estimatedMinutes > 0 && (
            <span className="lesson-card__time">⏱ {step.estimatedMinutes}m</span>
          )}
          <span className="lesson-card__expand">{isExpanded ? "▾" : "▸"}</span>
        </div>
      </div>

      {/* ── Body ── */}
      {isExpanded && (
        <div className="lesson-card__body">
          {/* Why This Matters */}
          {step.whyThisMatters && (
            <section className="lesson-card__section lesson-card__section--why">
              <h4 className="lesson-card__section-title">💡 Why This Matters</h4>
              <p>{step.whyThisMatters}</p>
            </section>
          )}

          {/* Summary fallback for non-enriched steps */}
          {!hasStructuredContent && step.summary && (
            <section className="lesson-card__section lesson-card__section--summary">
              <p>{step.summary}</p>
            </section>
          )}

          {/* Do This Now */}
          {step.whatToDo?.length > 0 && (
            <section className="lesson-card__section lesson-card__section--do">
              <h4 className="lesson-card__section-title">🔧 Do This Now</h4>
              <ol className="lesson-card__action-list">
                {step.whatToDo.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ol>
            </section>
          )}

          {/* Check It Worked */}
          {step.howToVerify?.length > 0 && (
            <section className="lesson-card__section lesson-card__section--verify">
              <h4 className="lesson-card__section-title">✅ Check It Worked</h4>
              <ul className="lesson-card__check-list">
                {step.howToVerify.map((check, i) => (
                  <li key={i}>{check}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Common Mistake */}
          {step.commonMistake && (
            <section className="lesson-card__section lesson-card__section--mistake">
              <h4 className="lesson-card__section-title">⚠️ Common Mistake</h4>
              <p>{step.commonMistake}</p>
            </section>
          )}

          {/* Key Takeaway */}
          {step.takeaway && (
            <section className="lesson-card__section lesson-card__section--takeaway">
              <h4 className="lesson-card__section-title">🎯 Key Takeaway</h4>
              <p className="lesson-card__takeaway">{step.takeaway}</p>
            </section>
          )}

          {/* Go Deeper */}
          {step.goDeeper?.length > 0 && (
            <section className="lesson-card__section lesson-card__section--deeper">
              <h4 className="lesson-card__section-title">📚 Go Deeper</h4>
              <ul className="lesson-card__links">
                {step.goDeeper.map((link, i) => (
                  <li key={i}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.type === "video" ? "🎬" : "📄"} {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
