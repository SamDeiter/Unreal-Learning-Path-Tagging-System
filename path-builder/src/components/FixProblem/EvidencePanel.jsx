/**
 * EvidencePanel - Expandable panel showing retrieved RAG passages with citations
 */
import { useState } from "react";
import PropTypes from "prop-types";
import "./FixProblem.css";

export default function EvidencePanel({ evidence }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!evidence || evidence.length === 0) return null;

  return (
    <details className="evidence-panel" open={isOpen} onToggle={(e) => setIsOpen(e.target.open)}>
      <summary className="evidence-toggle">
        <span className="evidence-icon">📎</span>
        Sources ({evidence.length})
      </summary>
      <div className="evidence-list">
        {evidence.map((item, i) => (
          <div key={i} className="evidence-item">
            <div className="evidence-item-header">
              <span className="evidence-ref">[{i + 1}]</span>
              <span className="evidence-source-badge">
                {item.source === "transcript" ? "🎬 Transcript" : "📄 Docs"}
              </span>
              {item.videoTitle && <span className="evidence-video-title">{item.videoTitle}</span>}
              {item.timestamp && <span className="evidence-timestamp">@ {item.timestamp}</span>}
            </div>
            <p className="evidence-text">{item.text}</p>
            {item.courseCode && <span className="evidence-course">Course: {item.courseCode}</span>}
          </div>
        ))}
      </div>
    </details>
  );
}

EvidencePanel.propTypes = {
  evidence: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string,
      source: PropTypes.string,
      courseCode: PropTypes.string,
      videoTitle: PropTypes.string,
      timestamp: PropTypes.string,
    })
  ),
};

EvidencePanel.defaultProps = {
  evidence: [],
};
