/**
 * PathProgress — Horizontal progress tracker showing path categories.
 * Clickable dots for navigation between steps.
 */

import { CATEGORY_STYLES } from "./pathConstants";

export default function PathProgress({ steps, currentStep, onStepClick }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="path-progress">
      <div className="progress-track">
        {steps.map((step, i) => {
          const style = CATEGORY_STYLES[step.category] || CATEGORY_STYLES.foundation;
          const isActive = i === currentStep;
          const isPast = i < currentStep;

          return (
            <div key={i} className="progress-item">
              {i > 0 && <div className={`progress-line ${isPast ? "completed" : ""}`} />}
              <button
                className={`progress-dot ${isActive ? "active" : ""} ${isPast ? "completed" : ""}`}
                onClick={() => onStepClick(i)}
                style={{
                  borderColor: style.color,
                  background: isActive || isPast ? style.color : "transparent",
                }}
                title={`Step ${i + 1}: ${style.label}`}
              >
                {isPast ? "✓" : i + 1}
              </button>
              <span className="progress-label">{style.icon}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
