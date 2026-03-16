import React from "react";
import PropTypes from "prop-types";
import { getDisplayName } from "../../services/topicNameService";
import { classifySegment, getBloomBadge } from "../../services/bloomClassifier";

/**
 * StepInspector - High-density metadata panel for a selected learning step.
 */
export default function StepInspector({ course, onPin, onReplace, onClose }) {
  if (!course) {
    return (
      <div className="step-inspector empty-inspector">
        <span className="icon">🔍</span>
        <p>Select a step to inspect its details and trace its origin.</p>
      </div>
    );
  }

  const bloom = classifySegment(course.title || "", course.gemini_enriched?.one_sentence_summary || "");
  const bloomBadge = getBloomBadge(bloom.level);
  const sourceLineage = course.sourceLineage || course.source || "Library";
  const isAI = course.source === 'ai' || course.source === 'ai_generated';

  return (
    <div className="step-inspector">
      <div className="inspector-header">
        <h3>Step Inspector</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="inspector-content">
        <section className="inspector-section">
          <label className="section-label">Titles</label>
          <div className="title-display">
            <div className="clean-title-box">
              <span className="badge">Clean</span>
              <h4>{getDisplayName(course)}</h4>
            </div>
            <div className="raw-title-box">
              <span className="badge">Raw</span>
              <p>{course.title}</p>
            </div>
          </div>
        </section>

        <section className="inspector-section">
          <label className="section-label">Trust & Lineage</label>
          <div className="lineage-card">
             <div className="lineage-row">
               <span>Source:</span>
               <span className={`lineage-badge ${isAI ? 'ai' : 'source'}`}>
                 {isAI ? '🤖 AI Generated' : '📚 Source Backed'}
               </span>
             </div>
             <div className="lineage-row">
               <span>Lineage:</span>
               <span className="lineage-val">{sourceLineage}</span>
             </div>
             {course.confidence && (
               <div className="lineage-row">
                 <span>Confidence:</span>
                 <span className="lineage-val">{(course.confidence * 100).toFixed(0)}%</span>
               </div>
             )}
          </div>
        </section>

        <section className="inspector-section">
          <label className="section-label">Instructional Goal</label>
          <div className="outcome-card">
            <span className="bloom-pill" style={{ backgroundColor: bloomBadge.color }}>
              {bloomBadge.label}
            </span>
            <p className="outcome-text">{course.outcome || bloom.summary}</p>
          </div>
        </section>

        <section className="inspector-section">
          <label className="section-label">Contextual Rationale</label>
          <div className="rationale-box">
            <p>{course.why || "No selection rationale provided. This step was likely added manually or via a basic search match."}</p>
          </div>
        </section>

        <section className="inspector-section">
          <label className="section-label">Preview Data</label>
          <div className="preview-data">
            <div className="data-row"><span>Code:</span> <code>{course.code}</code></div>
            <div className="data-row"><span>Estimated Time:</span> <code>{course.duration_minutes || '?'} mins</code></div>
          </div>
        </section>
      </div>

      <div className="inspector-footer">
        <button className="btn-epic-secondary" onClick={() => onPin(course.code)}>
          {course.isPinned ? "🔓 Unpin Step" : "📌 Pin Step"}
        </button>
        <button className="btn-epic-secondary" onClick={() => onReplace(course.code)}>
          🔄 Replace
        </button>
      </div>
    </div>
  );
}

StepInspector.propTypes = {
  course: PropTypes.object,
  onPin: PropTypes.func.isRequired,
  onReplace: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
};
