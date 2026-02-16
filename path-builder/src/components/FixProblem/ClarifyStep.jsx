/**
 * ClarifyStep - Renders the AI's clarifying question when confidence is low
 * Shows question, multiple-choice options, and an explanation of why it's asking.
 */
import PropTypes from "prop-types";
import "./FixProblem.css";

export default function ClarifyStep({ question, options, whyAsking, onAnswer, onSkip, isLoading }) {
  return (
    <div className="clarify-step">
      <div className="clarify-header">
        <span className="clarify-icon">🤔</span>
        <h3>Quick question before we diagnose</h3>
      </div>

      <p className="clarify-question">{question}</p>

      <div className="clarify-options">
        {(options || []).map((option, i) => (
          <button
            key={i}
            className="clarify-option-btn"
            onClick={() => onAnswer(option)}
            disabled={isLoading}
          >
            <span className="clarify-option-letter">{String.fromCharCode(65 + i)}</span>
            <span className="clarify-option-text">{option}</span>
          </button>
        ))}
      </div>

      {whyAsking && (
        <p className="clarify-why">
          <span className="clarify-why-label">Why we're asking:</span> {whyAsking}
        </p>
      )}

      <button className="clarify-skip-btn" onClick={onSkip} disabled={isLoading}>
        Skip — just give me the best answer you can
      </button>
    </div>
  );
}

ClarifyStep.propTypes = {
  question: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.string),
  whyAsking: PropTypes.string,
  onAnswer: PropTypes.func.isRequired,
  onSkip: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

ClarifyStep.defaultProps = {
  options: [],
  whyAsking: "",
  isLoading: false,
};
