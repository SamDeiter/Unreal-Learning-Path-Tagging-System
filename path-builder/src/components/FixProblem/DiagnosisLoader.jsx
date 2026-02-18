/**
 * DiagnosisLoader — Dedicated loading screen shown while the AI diagnoses.
 * Replaces the input form with an animated 3-phase progress indicator.
 */
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import "./FixProblem.css";

const PHASES = [
  { icon: "🔍", label: "Analyzing your problem...", detail: "Extracting intent and key systems" },
  {
    icon: "📚",
    label: "Searching knowledge base...",
    detail: "Finding relevant courses and documentation",
  },
  { icon: "🔧", label: "Building your fix...", detail: "Generating step-by-step solution" },
];

export default function DiagnosisLoader({ query }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2500);
    const t2 = setTimeout(() => setPhase(2), 5500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="dx-loader">
      <div className="dx-loader-card">
        <h2 className="dx-loader-title">
          <span className="dx-loader-spinner" /> Diagnosing...
        </h2>

        {/* Progress phases */}
        <div className="dx-phases">
          {PHASES.map((p, i) => (
            <div
              key={i}
              className={`dx-phase ${i < phase ? "done" : ""} ${i === phase ? "active" : ""} ${i > phase ? "pending" : ""}`}
            >
              <span className="dx-phase-icon">{i < phase ? "✓" : p.icon}</span>
              <div className="dx-phase-text">
                <span className="dx-phase-label">{p.label}</span>
                <span className="dx-phase-detail">{p.detail}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="dx-progress-bar">
          <div
            className="dx-progress-fill"
            style={{ width: `${((phase + 1) / PHASES.length) * 100}%` }}
          />
        </div>

        {/* Echoed query */}
        {query && (
          <div className="dx-query-echo">
            <span className="dx-query-label">Your question:</span>
            <p className="dx-query-text">&ldquo;{query}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}

DiagnosisLoader.propTypes = {
  query: PropTypes.string,
};

DiagnosisLoader.defaultProps = {
  query: "",
};
