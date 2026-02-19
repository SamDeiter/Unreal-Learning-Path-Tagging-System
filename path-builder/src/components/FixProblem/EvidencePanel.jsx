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

              {item.source === "transcript" ? (
                /* Transcripts: just show the timestamp */
                item.timestamp && <span className="evidence-timestamp">@ {item.timestamp}</span>
              ) : item.source === "epic_docs" && item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="evidence-doc-link"
                >
                  {item.title || "Epic Developer Community"}
                  <svg className="external-icon" viewBox="0 0 24 24" width="12" height="12">
                    <path
                      fill="currentColor"
                      d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zm-2 16H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7z"
                    />
                  </svg>
                </a>
              ) : (
                <>
                  {item.videoTitle && (
                    <span className="evidence-video-title">{item.videoTitle}</span>
                  )}
                  {item.timestamp && <span className="evidence-timestamp">@ {item.timestamp}</span>}
                </>
              )}
            </div>

            {item.source === "transcript" ? (
              /* Transcripts: just the raw quote */
              <p className="evidence-text">{item.text}</p>
            ) : (
              /* Docs: strip breadcrumbs, truncate */
              <p className="evidence-text">
                {item.text
                  ?.replace(/Unreal Engine \d\.\d/g, "")
                  .replace(/Epic Developer Community/g, "")
                  .replace(/\|/g, "")
                  .trim()
                  .substring(0, 300)}
                {item.text?.length > 300 ? "..." : ""}
              </p>
            )}
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
      url: PropTypes.string,
      title: PropTypes.string,
    })
  ),
};

EvidencePanel.defaultProps = {
  evidence: [],
};
