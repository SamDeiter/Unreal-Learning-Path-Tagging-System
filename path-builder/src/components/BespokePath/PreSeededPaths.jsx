/**
 * PreSeededPaths — "Popular Learning Paths" grid shown before user searches.
 * Displays 10 pre-built paths for common UE5 questions.
 */

import { CATEGORY_STYLES } from "./pathConstants";
import "./PreSeededPaths.css";

export default function PreSeededPaths({ paths, onSelect }) {
  if (!paths || paths.length === 0) return null;

  const difficultyColors = {
    simple: "#3fb950",
    medium: "#f0a020",
    complex: "#f85149",
  };

  return (
    <div className="preseeded-paths">
      <div className="preseeded-header">
        <h3 className="preseeded-title">🔥 Popular Learning Paths</h3>
        <p className="preseeded-subtitle">
          Pre-built paths for the most common UE5 questions — instant, no AI cost.
        </p>
      </div>

      <div className="preseeded-grid">
        {paths.map((path) => (
          <button key={path.id} className="preseeded-card" onClick={() => onSelect(path)}>
            <div className="card-header">
              <span
                className="card-difficulty"
                style={{ color: difficultyColors[path.difficulty] }}
              >
                {path.difficulty}
              </span>
              <span className="card-time">⏱ {path.estimatedMinutes} min</span>
            </div>

            <h4 className="card-question">{path.query}</h4>

            <div className="card-steps">
              {path.steps.map((step, i) => {
                const style = CATEGORY_STYLES[step.category] || CATEGORY_STYLES.foundation;
                return (
                  <span
                    key={i}
                    className="card-step-dot"
                    style={{ background: style.color }}
                    title={style.label}
                  />
                );
              })}
              <span className="card-step-count">{path.steps.length} steps</span>
            </div>

            <div className="card-tags">
              {path.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="card-tag">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
