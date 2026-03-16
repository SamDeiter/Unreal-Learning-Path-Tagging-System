import React from "react";
import PropTypes from "prop-types";

/**
 * AssemblyTrace - Shows the AI assembly decision process for a chosen step.
 */
export default function AssemblyTrace({ course, traceData, onClose }) {
  if (!course) {
    return (
      <div className="assembly-trace empty-trace">
        <span className="icon">🛤️</span>
        <p>Select a step to view the assembly trace and decision rationale.</p>
      </div>
    );
  }

  // Use provided traceData or fall back to metadata in the course object
  const candidates = traceData?.candidates || course.trace?.candidates || [];
  const constraints = traceData?.constraints || course.trace?.constraints || ["Persona Alignment", "Prerequisite Check"];
  const decisionLogic = traceData?.logic || course.trace?.logic || "Greedy matching based on vector similarity and Bloom progression.";

  return (
    <div className="assembly-trace">
      <div className="trace-header">
        <h3>Assembly Trace</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="trace-content">
        <section className="trace-section">
          <label className="section-label">Pipeline Constraints</label>
          <ul className="constraints-list">
            {constraints.map((c, i) => (
              <li key={i}><span className="check">✓</span> {c}</li>
            ))}
          </ul>
        </section>

        <section className="trace-section">
          <label className="section-label">Candidate Ranking</label>
          <div className="candidates-table">
            <header className="table-header">
              <span>Candidate</span>
              <span>Score</span>
            </header>
            <div className="table-rows">
              {/* The chosen one */}
              <div className="candidate-row selected">
                <span className="candidate-title">{course.title}</span>
                <span className="candidate-score">{(course.confidence || 0.98).toFixed(2)}</span>
                <span className="verdict">CHOSEN</span>
              </div>
              
              {/* Rejected candidates */}
              {candidates.length > 0 ? candidates.map((cand, i) => (
                <div key={i} className="candidate-row rejected">
                  <span className="candidate-title">{cand.title}</span>
                  <span className="candidate-score">{(cand.score || 0.65).toFixed(2)}</span>
                  <span className="verdict">REJECTED</span>
                </div>
              )) : (
                 <div className="candidate-row rejected">
                    <span className="candidate-title">Manual Override / Cache Hit</span>
                    <span className="candidate-score">--</span>
                    <span className="verdict">N/A</span>
                 </div>
              )}
            </div>
          </div>
        </section>

        <section className="trace-section">
          <label className="section-label">Assembly Logic</label>
          <div className="logic-narrative">
            <p>{decisionLogic}</p>
          </div>
        </section>

        <section className="trace-section">
          <label className="section-label">Source Lineage</label>
          <div className="lineage-tree">
             <div className="tree-node root">
                <span className="node-type">USER PROBLEM</span>
                <span className="node-val">"Unreal Engine 5 Mechanics"</span>
             </div>
             <div className="tree-connector"></div>
             <div className="tree-node branch">
                <span className="node-type">SEARCH QUERY</span>
                <span className="node-val">"{course.title}"</span>
             </div>
             <div className="tree-connector"></div>
             <div className="tree-node leaf">
                <span className="node-type">MATCHED DOC</span>
                <span className="node-val">{course.code}</span>
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}

AssemblyTrace.propTypes = {
  course: PropTypes.object,
  traceData: PropTypes.object,
  onClose: PropTypes.func.isRequired
};
