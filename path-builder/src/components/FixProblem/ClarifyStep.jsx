/**
 * ClarifyStep - Renders the AI's clarifying question when confidence is low.
 * Supports multi-turn conversation with history display and round counter.
 */
import PropTypes from "prop-types";
import "./FixProblem.css";

export default function ClarifyStep({
  question,
  options,
  whyAsking,
  onAnswer,
  onSkip,
  isLoading,
  clarifyRound,
  maxClarifyRounds,
  conversationHistory,
}) {
  return (
    <div className="clarify-step">
      {/* Round counter */}
      {clarifyRound > 0 && maxClarifyRounds > 1 && (
        <div className="clarify-round-counter">
          <span className="clarify-round-badge">
            Narrowing down… {clarifyRound} of {maxClarifyRounds}
          </span>
          <div className="clarify-round-bar">
            <div
              className="clarify-round-fill"
              style={{ width: `${(clarifyRound / maxClarifyRounds) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Previous conversation turns */}
      {conversationHistory.length > 0 && (
        <div className="clarify-history">
          {conversationHistory.map((turn, i) => (
            <div key={i} className={`clarify-history-turn clarify-history-${turn.role}`}>
              <span className="clarify-history-role">
                {turn.role === "assistant" ? "🤖 Asked:" : "👤 You said:"}
              </span>
              <span className="clarify-history-content">{turn.content}</span>
            </div>
          ))}
        </div>
      )}

      <div className="clarify-header">
        <span className="clarify-icon">🤔</span>
        <h3>
          {clarifyRound > 1
            ? "One more thing to narrow it down"
            : "Quick question before we diagnose"}
        </h3>
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
  clarifyRound: PropTypes.number,
  maxClarifyRounds: PropTypes.number,
  conversationHistory: PropTypes.arrayOf(
    PropTypes.shape({
      role: PropTypes.string.isRequired,
      content: PropTypes.string.isRequired,
    })
  ),
};

ClarifyStep.defaultProps = {
  options: [],
  whyAsking: "",
  isLoading: false,
  clarifyRound: 1,
  maxClarifyRounds: 3,
  conversationHistory: [],
};
