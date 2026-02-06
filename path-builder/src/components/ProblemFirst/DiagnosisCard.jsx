/**
 * DiagnosisCard - Display diagnosis with root causes and signals
 * Helps learners understand WHY the problem occurs
 */
import PropTypes from "prop-types";
import "./ProblemFirst.css";

export default function DiagnosisCard({ diagnosis }) {
  if (!diagnosis) return null;

  return (
    <div className="diagnosis-card">
      <div className="diagnosis-header">
        <h3>🔬 Diagnosis</h3>
        <span className="diagnosis-id">ID: {diagnosis.diagnosis_id?.slice(-8) || "N/A"}</span>
      </div>

      <p className="problem-summary">{diagnosis.problem_summary}</p>

      <div className="diagnosis-sections">
        {/* Root Causes - Most Important */}
        <section className="root-causes">
          <h4>
            <span className="icon">🎯</span>
            Root Causes
          </h4>
          <ul>
            {(diagnosis.root_causes || []).map((cause, index) => (
              <li key={index}>{cause}</li>
            ))}
          </ul>
        </section>

        {/* Signals to Watch For */}
        <section className="signals">
          <h4>
            <span className="icon">👁️</span>
            Signals to Watch For
          </h4>
          <ul>
            {(diagnosis.signals_to_watch_for || []).map((signal, index) => (
              <li key={index}>{signal}</li>
            ))}
          </ul>
        </section>

        {/* Variables Comparison */}
        <div className="variables-grid">
          <section className="variables-matter">
            <h4>
              <span className="icon">✅</span>
              Variables That Matter
            </h4>
            <ul>
              {(diagnosis.variables_that_matter || []).map((variable, index) => (
                <li key={index}>{variable}</li>
              ))}
            </ul>
          </section>

          <section className="variables-dont-matter">
            <h4>
              <span className="icon">❌</span>
              Variables That Don't
            </h4>
            <ul>
              {(diagnosis.variables_that_do_not || []).map((variable, index) => (
                <li key={index}>{variable}</li>
              ))}
            </ul>
          </section>
        </div>

        {/* Generalization Scope */}
        {diagnosis.generalization_scope?.length > 0 && (
          <section className="generalization">
            <h4>
              <span className="icon">🔄</span>
              Where Else This Applies
            </h4>
            <div className="scope-chips">
              {diagnosis.generalization_scope.map((scope, index) => (
                <span key={index} className="scope-chip">
                  {scope}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

DiagnosisCard.propTypes = {
  diagnosis: PropTypes.shape({
    diagnosis_id: PropTypes.string,
    problem_summary: PropTypes.string,
    root_causes: PropTypes.arrayOf(PropTypes.string),
    signals_to_watch_for: PropTypes.arrayOf(PropTypes.string),
    variables_that_matter: PropTypes.arrayOf(PropTypes.string),
    variables_that_do_not: PropTypes.arrayOf(PropTypes.string),
    generalization_scope: PropTypes.arrayOf(PropTypes.string),
  }),
};

DiagnosisCard.defaultProps = {
  diagnosis: null,
};
