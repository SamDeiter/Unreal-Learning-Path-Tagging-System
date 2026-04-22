/**
 * AnswerView - Fix-first answer layout
 * Displays: Most likely cause → Fast checks → Fix steps → If still broken → Learn path → Evidence
 */

import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import EvidencePanel from "./EvidencePanel";
import FeedbackPanel from "./FeedbackPanel";
import OfficialDocsSummary from "../OfficialDocsSummary/OfficialDocsSummary";
import highlightWithCitations from "../../utils/highlightWithCitations";
import "./FixProblem.css";

// Stable-ish session key so refreshing mid-troubleshoot keeps progress,
// but a fresh question re-keys and starts over.
function fixStepsKey(cause, steps) {
  if (!steps?.length) return null;
  const sig = `${cause || ""}::${steps.length}::${(steps[0] || "").slice(0, 40)}`;
  let h = 5381;
  for (let i = 0; i < sig.length; i++) h = ((h << 5) + h + sig.charCodeAt(i)) | 0;
  return `fixSteps:${h}`;
}

function loadCheckedSteps(key) {
  if (!key || typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export default function AnswerView({
  answer,
  onFeedback,
  onBackToVideos,
  onStartOver,
  isRerunning,
  vertexAIDocs,
  vertexAILoading,
  vertexAIError,
}) {
  // Hooks must run unconditionally, before any early return.
  const stepsKey = useMemo(
    () => fixStepsKey(answer?.mostLikelyCause, answer?.fixSteps),
    [answer?.mostLikelyCause, answer?.fixSteps]
  );

  const [checkedSteps, setCheckedSteps] = useState(() => loadCheckedSteps(stepsKey));
  // Reset state when stepsKey changes — React-recommended alternative to
  // setState-in-effect (https://react.dev/learn/you-might-not-need-an-effect).
  const [prevStepsKey, setPrevStepsKey] = useState(stepsKey);
  if (prevStepsKey !== stepsKey) {
    setPrevStepsKey(stepsKey);
    setCheckedSteps(loadCheckedSteps(stepsKey));
  }

  useEffect(() => {
    if (!stepsKey || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(stepsKey, JSON.stringify([...checkedSteps]));
    } catch {
      // session storage full / disabled — non-fatal
    }
  }, [stepsKey, checkedSteps]);

  if (!answer) return null;

  const confidenceColor =
    answer.confidence === "high" ? "#10b981" : answer.confidence === "med" ? "#f59e0b" : "#ef4444";

  // Shorthand: highlight terms + make [N] citations clickable
  const cite = (text) => highlightWithCitations(text, vertexAIDocs?.results);

  const toggleStep = (i) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const resetSteps = () => setCheckedSteps(new Set());

  const totalSteps = answer.fixSteps?.length || 0;
  const doneCount = checkedSteps.size;
  const allStepsDone = totalSteps > 0 && doneCount === totalSteps;

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

      <p className="answer-cause">{cite(answer.mostLikelyCause)}</p>

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
                <span>{cite(check)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Fix Steps (interactive checklist) ─── */}
      {answer.fixSteps?.length > 0 && (
        <div className="answer-section answer-fix-steps">
          <h3>
            <span className="section-icon">🔧</span>
            <span>Fix Steps</span>
            <span
              className="fix-step-progress"
              aria-live="polite"
              aria-label={`${doneCount} of ${totalSteps} steps completed`}
            >
              {doneCount} of {totalSteps} done
            </span>
            {doneCount > 0 && (
              <button
                type="button"
                className="fix-step-reset"
                onClick={resetSteps}
                title="Uncheck every step"
              >
                Reset
              </button>
            )}
          </h3>
          <ul className="fix-step-list">
            {answer.fixSteps.map((step, i) => {
              const checked = checkedSteps.has(i);
              return (
                <li key={i} className={`fix-step-item ${checked ? "checked" : ""}`}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStep(i)}
                      aria-label={`Mark step ${i + 1} complete`}
                    />
                    <span className="fix-step-number">{i + 1}</span>
                    <span className="fix-step-text">{cite(step)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {allStepsDone && (
            <div className="fix-steps-complete" role="status">
              🎉 Nice — every step tried. Did this resolve it? Let me know below so I can
              improve.
            </div>
          )}
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
                <span className="branch-condition">If {cite(branch.condition)}:</span>
                <span className="branch-action">{cite(branch.action)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Why This Result (collapsible — reduces cognitive load on main flow) ─── */}
      {answer.whyThisResult?.length > 0 && (
        <details className="answer-section answer-reasoning answer-reasoning-collapsible">
          <summary>
            <span className="section-icon">💡</span>
            <span className="reasoning-summary-label">How the AI reached this conclusion</span>
          </summary>
          <ul className="reasoning-list">
            {answer.whyThisResult.map((reason, i) => (
              <li key={i}>
                <span>{cite(reason)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* ─── Skills You'll Build (takeaway — placed after reasoning) ─── */}
      {answer.learnPath?.objectives?.transferable?.length > 0 && (
        <div className="answer-section answer-skills">
          <h3>
            <span className="section-icon">🔄</span> What you&apos;ll take away from this
          </h3>
          <p className="skills-intro">
            Beyond fixing this specific issue, here&apos;s the transferable skill you&apos;ll build:
          </p>
          <ul className="skills-list">
            {answer.learnPath.objectives.transferable.map((skill, i) => (
              <li key={i}>{cite(skill)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Evidence Panel ─── */}
      <EvidencePanel evidence={answer.evidence} />

      {/* ─── Actions ─── */}
      <div className="answer-actions">
        <button className="answer-action-btn primary" onClick={onBackToVideos}>
          📚 Browse Related Resources
        </button>
        <button className="answer-action-btn secondary" onClick={onStartOver}>
          ← Ask Another Question
        </button>
      </div>

      {/* ─── Feedback ─── */}
      <FeedbackPanel onFeedback={onFeedback} isRerunning={isRerunning} />

      {/* ─── Official Docs (bottom of page) ─── */}
      <OfficialDocsSummary data={vertexAIDocs} isLoading={vertexAILoading} error={vertexAIError} />
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
      objectives: PropTypes.shape({
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
