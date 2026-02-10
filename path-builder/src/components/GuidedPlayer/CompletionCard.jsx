/**
 * CompletionCard — End-of-path summary with reflection prompt and stats.
 */
import PropTypes from "prop-types";

export default function CompletionCard({
  courses,
  totalDuration,
  reflectionText,
  onReflectionChange,
  wordCount,
  onFinish,
  onExit,
}) {
  return (
    <div className="complete-card">
      <div className="complete-icon">🎉</div>
      <h2>Path Complete!</h2>
      <p>You&apos;ve learned the skills to solve this problem and similar ones in the future.</p>
      <div className="stats">
        <div className="stat">
          <span className="value">{courses.length}</span>
          <span className="label">Lessons</span>
        </div>
        <div className="stat">
          <span className="value">{totalDuration || "—"}</span>
          <span className="label">Total Time</span>
        </div>
      </div>

      {/* Reflection Prompt */}
      <div className="reflection-area">
        <h3>📝 What was your main takeaway?</h3>
        <p className="reflection-subtitle">
          Writing your reflection helps cement what you learned.
        </p>
        <textarea
          className="reflection-input"
          placeholder="I learned that..."
          value={reflectionText}
          onChange={(e) => onReflectionChange(e.target.value)}
          rows={4}
        />
        <div className="reflection-meta">
          {wordCount === 0 && <span className="word-hint">Try writing a few sentences</span>}
          {wordCount > 0 && wordCount < 10 && (
            <span className="word-hint">{wordCount} words — keep going!</span>
          )}
          {wordCount >= 10 && <span className="word-hint done">Great reflection! ✓</span>}
        </div>
      </div>

      <div className="completion-actions">
        <button className="finish-btn" onClick={onFinish}>
          {reflectionText.trim() ? "Save & Finish" : "Back to Problems"}
        </button>
        {onExit && (
          <button className="back-to-path-btn" onClick={onExit}>
            ← Back to Learning Path
          </button>
        )}
      </div>
    </div>
  );
}

CompletionCard.propTypes = {
  courses: PropTypes.array.isRequired,
  totalDuration: PropTypes.string,
  reflectionText: PropTypes.string.isRequired,
  onReflectionChange: PropTypes.func.isRequired,
  wordCount: PropTypes.number.isRequired,
  onFinish: PropTypes.func.isRequired,
};
