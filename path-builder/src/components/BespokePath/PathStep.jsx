/**
 * PathStep — A single step in a bespoke learning path.
 * Renders differently based on source type (transcript, epic_learning, docs).
 */

import { CATEGORY_STYLES } from "./pathConstants";

export default function PathStep({ step, index, isActive, onClick }) {
  const { segment, category } = step;
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.foundation;

  const renderSource = () => {
    switch (segment.type) {
      case "transcript":
        return (
          <div className="step-source transcript-source">
            <span className="source-icon">🎬</span>
            <div className="source-info">
              <span className="source-title">{segment.videoTitle}</span>
              {segment.startTimestamp && (
                <span className="source-timestamp">
                  ⏱ {segment.startTimestamp}
                  {segment.endTimestamp ? ` – ${segment.endTimestamp}` : ""}
                </span>
              )}
              {segment.courseCode && <span className="source-course">📚 {segment.courseCode}</span>}
            </div>
          </div>
        );

      case "epic_learning":
        return (
          <div className="step-source epic-source">
            <span className="source-icon">📖</span>
            <div className="source-info">
              <span className="source-title">{segment.title}</span>
              {segment.author && <span className="source-author">by {segment.author}</span>}
              {segment.url && (
                <a
                  href={segment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link"
                >
                  Open in Epic Dev →
                </a>
              )}
            </div>
          </div>
        );

      case "docs":
        return (
          <div className="step-source docs-source">
            <span className="source-icon">📄</span>
            <div className="source-info">
              <span className="source-title">{segment.title}</span>
              {segment.section && <span className="source-section">§ {segment.section}</span>}
              {segment.url && (
                <a
                  href={segment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link"
                >
                  Open Docs →
                </a>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`path-step ${isActive ? "active" : ""} category-${category}`}
      onClick={onClick}
      style={{ "--step-accent": style.color }}
    >
      <div className="step-header">
        <div className="step-number">
          <span className="step-num">{index + 1}</span>
        </div>
        <div className="step-category-badge" style={{ background: style.color }}>
          {style.icon} {style.label}
        </div>
        <div className="step-similarity">{Math.round((segment.similarity || 0) * 100)}% match</div>
      </div>

      {renderSource()}

      <div className="step-text">
        <p>{segment.text}</p>
      </div>
    </div>
  );
}
