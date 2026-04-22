/**
 * FeedbackBar — inline row of signal chips below assistant diagnosis/path bubbles.
 *
 * Props:
 *   sessionId:     string         — required; bar hides when null/undefined
 *   tagsTouched?:  string[]       — tags pulled from bubble content
 *   onSubmitted?:  (signal) => void
 *   className?:    string
 */
import { useState } from "react";
import PropTypes from "prop-types";
import useFeedback from "../../hooks/useFeedback";
import "./FeedbackBar.css";

const SIGNALS = [
  { key: "helpful", label: "Helpful" },
  { key: "already_knew", label: "Already knew this" },
  { key: "confused", label: "Confused" },
  { key: "not_helpful", label: "Not helpful" },
];

export default function FeedbackBar({ sessionId, tagsTouched, onSubmitted, className }) {
  const { submit, loading, lastSignal } = useFeedback();
  const [localError, setLocalError] = useState(null);
  const [submittedSignal, setSubmittedSignal] = useState(null);

  if (!sessionId) return null;

  const active = submittedSignal || lastSignal[sessionId] || null;
  const done = Boolean(active) && !localError;

  const handleClick = async (signal) => {
    setLocalError(null);
    const res = await submit({ sessionId, signal, tagsTouched });
    if (res.ok) {
      setSubmittedSignal(signal);
      onSubmitted?.(signal);
    } else {
      setLocalError(res.error || "Couldn't record that");
    }
  };

  const handleRetry = () => {
    setLocalError(null);
  };

  const rootClass = ["feedback-bar", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass} role="group" aria-label="Rate this response">
      <span className="feedback-bar__label">Was this useful?</span>
      {SIGNALS.map((s) => (
        <button
          key={s.key}
          type="button"
          className={`feedback-bar__chip${active === s.key ? " is-active" : ""}`}
          disabled={loading || done}
          onClick={() => handleClick(s.key)}
          aria-pressed={active === s.key}
        >
          {s.label}
        </button>
      ))}
      {done && <span className="feedback-bar__status">Thanks — noted.</span>}
      {localError && (
        <span className="feedback-bar__status is-error">
          Couldn&apos;t record that —{" "}
          <button type="button" className="feedback-bar__retry" onClick={handleRetry}>
            try again
          </button>
        </span>
      )}
    </div>
  );
}

FeedbackBar.propTypes = {
  sessionId: PropTypes.string,
  tagsTouched: PropTypes.arrayOf(PropTypes.string),
  onSubmitted: PropTypes.func,
  className: PropTypes.string,
};
