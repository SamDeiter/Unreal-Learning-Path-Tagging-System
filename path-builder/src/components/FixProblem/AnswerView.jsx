/**
 * AnswerView - Fix-first answer layout
 * Displays: Most likely cause → Fast checks → Fix steps → If still broken → Learn path → Evidence
 */
import { useState } from "react";
import PropTypes from "prop-types";
import EvidencePanel from "./EvidencePanel";
import FeedbackPanel from "./FeedbackPanel";
import highlightTerms from "../../utils/highlightTerms";
import "./FixProblem.css";

export default function AnswerView({
  answer,
  onFeedback,
  onBackToVideos,
  onStartOver,
  isRerunning,
}) {
  const [learnPathOpen, setLearnPathOpen] = useState(false);

  if (!answer) return null;

  const confidenceColor =
    answer.confidence === "high" ? "#10b981" : answer.confidence === "med" ? "#f59e0b" : "#ef4444";

  return (
    <div className="answer-view">
      {/* ─── Header ─── */}
      <div className="answer-header">
        <h2 className="answer-title">
          <span className="answer-icon">🎯</span> Most Likely Cause
        </h2>
        <span
          className="answer-confidence-badge"
          style={{
            background: `${confidenceColor}22`,
            color: confidenceColor,
            border: `1px solid ${confidenceColor}44`,
          }}
        >
          {answer.confidence} confidence
        </span>
      </div>

      <p className="answer-cause">{highlightTerms(answer.mostLikelyCause)}</p>

      {/* ─── Fast Checks ─── */}
      {answer.fastChecks?.length > 0 && (
        <div className="answer-section answer-fast-checks">
          <h3>
            <span className="section-icon">⚡</span> Quick Checks
          </h3>
          <ul>
            {answer.fastChecks.map((check, i) => (
              <li key={i}>
                <span className="check-number">{i + 1}</span>
                <span>{highlightTerms(check)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Fix Steps ─── */}
      {answer.fixSteps?.length > 0 && (
        <div className="answer-section answer-fix-steps">
          <h3>
            <span className="section-icon">🔧</span> Fix Steps
          </h3>
          <ol>
            {answer.fixSteps.map((step, i) => (
              <li key={i}>{highlightTerms(step)}</li>
            ))}
          </ol>
        </div>
      )}

      {/* ─── If Still Broken ─── */}
      {answer.ifStillBrokenBranches?.length > 0 && (
        <div className="answer-section answer-branches">
          <h3>
            <span className="section-icon">🔀</span> If Still Broken
          </h3>
          <div className="branch-list">
            {answer.ifStillBrokenBranches.map((branch, i) => (
              <div key={i} className="branch-item">
                <span className="branch-condition">If {highlightTerms(branch.condition)}:</span>
                <span className="branch-action">{highlightTerms(branch.action)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Learn Path (accordion) ─── */}
      {answer.learnPath && (
        <details
          className="answer-section answer-learn-path"
          open={learnPathOpen}
          onToggle={(e) => setLearnPathOpen(e.target.open)}
        >
          <summary>
            <span className="section-icon">📚</span> Learn More
            <span className="learn-path-badge">
              {answer.learnPath.topicsCovered?.length || 0} topics
            </span>
          </summary>
          <div className="learn-path-content">
            <p className="learn-path-summary">{answer.learnPath.pathSummary}</p>
            {answer.learnPath.objectives && (
              <div className="learn-path-objectives">
                {answer.learnPath.objectives.fixSpecific?.length > 0 && (
                  <div>
                    <h4>🎯 Fix-Specific</h4>
                    <ul>
                      {answer.learnPath.objectives.fixSpecific.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {answer.learnPath.objectives.transferable?.length > 0 && (
                  <div>
                    <h4>🔄 Transferable Skills</h4>
                    <ul>
                      {answer.learnPath.objectives.transferable.map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </details>
      )}

      {/* ─── Why This Result ─── */}
      {answer.whyThisResult?.length > 0 && (
        <div className="answer-section answer-reasoning">
          <h3>
            <span className="section-icon">💡</span> Why This Result
          </h3>
          <ul className="reasoning-list">
            {answer.whyThisResult.map((reason, i) => (
              <li key={i}>{highlightTerms(reason)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Evidence Panel ─── */}
      <EvidencePanel evidence={answer.evidence} />

      {/* ─── Actions ─── */}
      <div className="answer-actions">
        <button className="answer-action-btn primary" onClick={onBackToVideos}>
          🎬 Browse Related Videos
        </button>
        <button className="answer-action-btn secondary" onClick={onStartOver}>
          ← Ask Another Question
        </button>
      </div>

      {/* ─── Feedback ─── */}
      <FeedbackPanel onFeedback={onFeedback} isRerunning={isRerunning} />
    </div>
  );
}

AnswerView.propTypes = {
  answer: PropTypes.shape({
    mostLikelyCause: PropTypes.string,
    confidence: PropTypes.oneOf(["high", "med", "low"]),
    fastChecks: PropTypes.arrayOf(PropTypes.string),
    fixSteps: PropTypes.arrayOf(PropTypes.string),
    ifStillBrokenBranches: PropTypes.arrayOf(
      PropTypes.shape({
        condition: PropTypes.string,
        action: PropTypes.string,
      })
    ),
    learnPath: PropTypes.shape({
      pathSummary: PropTypes.string,
      topicsCovered: PropTypes.arrayOf(PropTypes.string),
      objectives: PropTypes.shape({
        fixSpecific: PropTypes.arrayOf(PropTypes.string),
        transferable: PropTypes.arrayOf(PropTypes.string),
      }),
    }),
    whyThisResult: PropTypes.arrayOf(PropTypes.string),
    evidence: PropTypes.array,
  }),
  onFeedback: PropTypes.func.isRequired,
  onBackToVideos: PropTypes.func.isRequired,
  onStartOver: PropTypes.func.isRequired,
  isRerunning: PropTypes.bool,
};

AnswerView.defaultProps = {
  answer: null,
  isRerunning: false,
};
