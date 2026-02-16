/**
 * FeedbackPanel - "Did this solve it?" Yes/No with reason collection
 * If No → collects reason → triggers parent rerun with exclusions
 */
import { useState, useCallback } from "react";
import PropTypes from "prop-types";
import "./FixProblem.css";

export default function FeedbackPanel({ onFeedback, isRerunning }) {
  const [state, setState] = useState("ask"); // ask | no-reason | thanks
  const [reason, setReason] = useState("");

  const handleYes = useCallback(() => {
    setState("thanks");
    onFeedback({ solved: true });
  }, [onFeedback]);

  const handleNo = useCallback(() => {
    setState("no-reason");
  }, []);

  const handleSubmitReason = useCallback(() => {
    onFeedback({ solved: false, reason: reason.trim() });
    setState("thanks");
  }, [onFeedback, reason]);

  if (state === "thanks") {
    return (
      <div className="feedback-panel feedback-thanks">
        <span className="feedback-icon">✅</span>
        <span>Thanks for the feedback!</span>
        {isRerunning && (
          <span className="feedback-rerunning">Re-analyzing with your feedback...</span>
        )}
      </div>
    );
  }

  if (state === "no-reason") {
    return (
      <div className="feedback-panel feedback-reason">
        <p className="feedback-question">What didn&apos;t work?</p>
        <textarea
          className="feedback-textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. I already tried that, the setting doesn't exist in my version, the issue is different..."
          maxLength={300}
          rows={2}
          disabled={isRerunning}
        />
        <button
          className="feedback-submit-btn"
          onClick={handleSubmitReason}
          disabled={reason.trim().length < 5 || isRerunning}
        >
          {isRerunning ? (
            <>
              <span className="spinner" /> Re-analyzing...
            </>
          ) : (
            "Try a different approach →"
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="feedback-panel feedback-ask">
      <p className="feedback-question">Did this solve your problem?</p>
      <div className="feedback-buttons">
        <button className="feedback-btn feedback-yes" onClick={handleYes}>
          👍 Yes
        </button>
        <button className="feedback-btn feedback-no" onClick={handleNo}>
          👎 No
        </button>
      </div>
    </div>
  );
}

FeedbackPanel.propTypes = {
  onFeedback: PropTypes.func.isRequired,
  isRerunning: PropTypes.bool,
};

FeedbackPanel.defaultProps = {
  isRerunning: false,
};
