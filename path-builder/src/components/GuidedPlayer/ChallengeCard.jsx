/**
 * ChallengeCard — Hands-on challenge with task, expected result, and hint.
 */
import PropTypes from "prop-types";

export default function ChallengeCard({ challengeContent, onComplete }) {
  return (
    <div className="challenge-card">
      <div className="challenge-icon">🔨</div>
      <h3>Try It Yourself</h3>
      <div className="challenge-difficulty">
        <span className={`difficulty-badge ${challengeContent.difficulty.toLowerCase()}`}>
          {challengeContent.difficulty}
        </span>
      </div>
      <p className="challenge-task">{challengeContent.task}</p>
      {challengeContent.expectedResult && (
        <div className="challenge-expected">
          <span className="expected-label">👁️ What to look for:</span>{" "}
          {challengeContent.expectedResult}
        </div>
      )}
      <div className="challenge-hint">
        <span className="hint-label">💡 Hint:</span> {challengeContent.hint}
      </div>
      {challengeContent.docsUrl && (
        <a
          className="docs-link"
          href={challengeContent.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          📖 Read the official UE5 docs →
        </a>
      )}
      <button className="challenge-done-btn" onClick={onComplete}>
        I tried it →
      </button>
      <button className="challenge-skip-btn" onClick={onComplete}>
        Skip challenge
      </button>
    </div>
  );
}

ChallengeCard.propTypes = {
  challengeContent: PropTypes.shape({
    task: PropTypes.string.isRequired,
    hint: PropTypes.string.isRequired,
    expectedResult: PropTypes.string,
    docsUrl: PropTypes.string,
    difficulty: PropTypes.string.isRequired,
  }).isRequired,
  onComplete: PropTypes.func.isRequired,
};
