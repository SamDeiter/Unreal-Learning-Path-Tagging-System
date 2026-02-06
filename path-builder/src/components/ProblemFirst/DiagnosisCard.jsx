/**
 * DiagnosisCard - Display diagnosis with root causes and signals
 * Helps learners understand WHY the problem occurs
 */
import PropTypes from "prop-types";
import "./ProblemFirst.css";

export default function DiagnosisCard({ diagnosis }) {
  if (!diagnosis) return null;

  const rootCausesCount = diagnosis.root_causes?.length || 0;
  const signalsCount = diagnosis.signals_to_watch_for?.length || 0;
  const varMatterCount = diagnosis.variables_that_matter?.length || 0;
  const varDontCount = diagnosis.variables_that_do_not?.length || 0;

  return (
    <div className="diagnosis-card">
      <div className="diagnosis-header">
        <h3>🔬 Diagnosis</h3>
        <span className="diagnosis-id">ID: {diagnosis.diagnosis_id?.slice(-8) || "N/A"}</span>
      </div>

      <p className="problem-summary">{diagnosis.problem_summary}</p>

      <div className="diagnosis-sections">
        {/* Root Causes - Most Important */}
        <details className="diagnosis-section root-causes">
          <summary>
            <span className="icon">🎯</span>
            Root Causes
            <span className="count">({rootCausesCount})</span>
          </summary>
          <ul>
            {(diagnosis.root_causes || []).map((cause, index) => (
              <li key={index}>{cause}</li>
            ))}
          </ul>
        </details>

        {/* Signals to Watch For */}
        <details className="diagnosis-section signals">
          <summary>
            <span className="icon">👁️</span>
            Signals to Watch For
            <span className="count">({signalsCount})</span>
          </summary>
          <ul>
            {(diagnosis.signals_to_watch_for || []).map((signal, index) => (
              <li key={index}>{signal}</li>
            ))}
          </ul>
        </details>

        {/* Variables That Matter */}
        <details className="diagnosis-section variables-matter">
          <summary>
            <span className="icon">✅</span>
            Variables That Matter
            <span className="count">({varMatterCount})</span>
          </summary>
          <ul>
            {(diagnosis.variables_that_matter || []).map((variable, index) => (
              <li key={index}>{variable}</li>
            ))}
          </ul>
        </details>

        {/* Variables That Don't Matter */}
        <details className="diagnosis-section variables-dont-matter">
          <summary>
            <span className="icon">❌</span>
            Variables That Don't
            <span className="count">({varDontCount})</span>
          </summary>
          <ul>
            {(diagnosis.variables_that_do_not || []).map((variable, index) => (
              <li key={index}>{variable}</li>
            ))}
          </ul>
        </details>

        {/* Generalization Scope */}
        {diagnosis.generalization_scope?.length > 0 && (
          <details className="diagnosis-section generalization" open>
            <summary>
              <span className="icon">🔄</span>
              Where Else This Applies
              <span className="count">({diagnosis.generalization_scope.length})</span>
            </summary>
            <div className="scope-chips">
              {diagnosis.generalization_scope.map((scope, index) => (
                <span key={index} className="scope-chip">
                  {scope}
                </span>
              ))}
            </div>
          </details>
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
