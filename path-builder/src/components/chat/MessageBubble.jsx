/**
 * MessageBubble — single chat bubble.
 *
 * Props:
 *   message: { id, role: 'user'|'assistant', kind, content, createdAt }
 *   onClarifyAnswer?: (choice: string) => void   // required for kind === 'clarification'
 *   onClarifySkip?:  () => void
 *   renderRich?: (message) => ReactNode          // escape hatch for 'diagnosis'/'path' rendering
 *   sessionId?: string                            // plumbed to FeedbackBar on diagnosis/path bubbles
 */
import PropTypes from "prop-types";
import FeedbackBar from "./FeedbackBar";

function TypingIndicator() {
  return (
    <span className="chat-typing" aria-label="Assistant is typing">
      <span />
      <span />
      <span />
    </span>
  );
}

function ClarificationBubble({ content, onAnswer, onSkip }) {
  const { question, options = [], whyAsking, clarifyRound, maxClarifyRounds } = content || {};
  return (
    <div>
      {clarifyRound && maxClarifyRounds ? (
        <div className="chat-clarify-round">
          Follow-up {clarifyRound} of {maxClarifyRounds}
        </div>
      ) : null}
      <div>{question}</div>
      {whyAsking && <div className="chat-clarify-why">Why we're asking: {whyAsking}</div>}
      {options.length > 0 && (
        <div className="chat-clarify-options">
          {options.map((opt, i) => {
            const label = typeof opt === "string" ? opt : opt.label || opt.value;
            return (
              <button
                key={i}
                type="button"
                className="chat-clarify-option"
                onClick={() => onAnswer?.(label)}
              >
                {label}
              </button>
            );
          })}
          {onSkip && (
            <button type="button" className="chat-clarify-skip" onClick={onSkip}>
              Skip — best effort
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({
  message,
  onClarifyAnswer,
  onClarifySkip,
  renderRich,
  sessionId,
}) {
  const { role, kind, content } = message;

  if (kind === "typing") {
    return (
      <div className="chat-bubble-row assistant">
        <div className="chat-bubble assistant">
          <TypingIndicator />
        </div>
      </div>
    );
  }

  if (kind === "clarification") {
    return (
      <div className="chat-bubble-row assistant">
        <div className="chat-bubble assistant">
          <ClarificationBubble
            content={content}
            onAnswer={onClarifyAnswer}
            onSkip={onClarifySkip}
          />
        </div>
      </div>
    );
  }

  if (kind === "diagnosis" || kind === "path") {
    const tagsTouched = Array.isArray(content?.cartData?.diagnosis?.matched_tag_ids)
      ? content.cartData.diagnosis.matched_tag_ids
      : Array.isArray(content?.cartData?.tags)
        ? content.cartData.tags
        : [];
    return (
      <div className="chat-bubble-row assistant">
        <div className="chat-bubble assistant rich">
          {renderRich ? renderRich(message) : <pre>{JSON.stringify(content, null, 2)}</pre>}
          <FeedbackBar sessionId={sessionId} tagsTouched={tagsTouched} />
        </div>
      </div>
    );
  }

  const classes = ["chat-bubble", role];
  if (kind === "error") classes.push("error");

  return (
    <div className={`chat-bubble-row ${role}`}>
      <div className={classes.join(" ")}>{typeof content === "string" ? content : String(content)}</div>
    </div>
  );
}

MessageBubble.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["user", "assistant"]).isRequired,
    kind: PropTypes.string.isRequired,
    content: PropTypes.any,
    createdAt: PropTypes.number,
  }).isRequired,
  onClarifyAnswer: PropTypes.func,
  onClarifySkip: PropTypes.func,
  renderRich: PropTypes.func,
  sessionId: PropTypes.string,
};
