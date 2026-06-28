/**
 * AnswerView - Fix-first answer layout
 * Displays: Most likely cause → How it works → Verify the pieces → Fix steps
 *           → If still broken → (reasoning, collapsible) → Skills → Evidence
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import EvidencePanel from "./EvidencePanel";
import FeedbackPanel from "./FeedbackPanel";
import HowItWorksDiagram from "./HowItWorksDiagram";
import OfficialDocsSummary from "../OfficialDocsSummary/OfficialDocsSummary";
import highlightWithCitations from "../../utils/highlightWithCitations";
import { splitTitle, openFixStepsPopout, loadCheckedSteps, fixStepsKey } from "./popoutUtils";
import "./FixProblem.css";

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
  const [stepIndex, setStepIndex] = useState(0);
  // Reset state when stepsKey changes — React-recommended alternative to
  // setState-in-effect (https://react.dev/learn/you-might-not-need-an-effect).
  const [prevStepsKey, setPrevStepsKey] = useState(stepsKey);
  if (prevStepsKey !== stepsKey) {
    setPrevStepsKey(stepsKey);
    setCheckedSteps(loadCheckedSteps(stepsKey));
    setStepIndex(0);
  }

  useEffect(() => {
    if (!stepsKey || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(stepsKey, JSON.stringify([...checkedSteps]));
    } catch {
      // session storage full / disabled — non-fatal
    }
  }, [stepsKey, checkedSteps]);

  // Popup window handle — kept in a ref so it survives re-renders.
  const popoutRef = useRef(null);

  const toggleStep = useCallback((i) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  // Push state changes to the popup so it stays in sync with main window edits.
  useEffect(() => {
    const popup = popoutRef.current;
    if (popup && !popup.closed) {
      popup.postMessage(
        { type: "fixStepsSync", checked: [...checkedSteps] },
        window.location.origin
      );
    }
  }, [checkedSteps]);

  // Accept toggle messages from the popup.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (e) => {
      if (e.source !== popoutRef.current) return;
      const d = e.data;
      if (!d || d.type !== "fixStepsToggle") return;
      if (typeof d.index !== "number") return;
      toggleStep(d.index);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [toggleStep]);

  // Close stale popup when the answer changes (new question => new steps).
  useEffect(() => {
    if (popoutRef.current && !popoutRef.current.closed) {
      popoutRef.current.close();
    }
    popoutRef.current = null;
  }, [stepsKey]);

  if (!answer) return null;

  const confidenceColor =
    answer.confidence === "high" ? "#10b981" : answer.confidence === "med" ? "#f59e0b" : "#ef4444";

  // Shorthand: highlight terms + make [N] citations clickable
  const cite = (text) => highlightWithCitations(text, vertexAIDocs?.results);

  const resetSteps = () => setCheckedSteps(new Set());

  const openPopout = () => {
    if (popoutRef.current && !popoutRef.current.closed) {
      popoutRef.current.focus();
      return;
    }
    popoutRef.current = openFixStepsPopout({
      steps: answer.fixSteps || [],
      checked: checkedSteps,
    });
  };

  const totalSteps = answer.fixSteps?.length || 0;
  const doneCount = checkedSteps.size;
  const allStepsDone = totalSteps > 0 && doneCount === totalSteps;

  // Build the stepper sequence from whatever sections the answer actually has.
  // Order follows the canonical tutor flow (concept → verify → act → reflect).
  const stepper = [];
  stepper.push({ id: "cause", label: "Most Likely Cause", icon: "🎯" });
  if (answer.howItWorks) {
    stepper.push({ id: "howItWorks", label: "How This Works", icon: "🧭" });
  }
  if (answer.fastChecks?.length > 0) {
    stepper.push({ id: "verify", label: "Verify The Pieces", icon: "⚡" });
  }
  if (answer.fixSteps?.length > 0) {
    stepper.push({ id: "fix", label: "Fix Steps", icon: "🔧" });
  }
  if (answer.ifStillBrokenBranches?.length > 0) {
    stepper.push({ id: "branches", label: "If Still Broken", icon: "🔀" });
  }
  const hasTakeaway =
    answer.learnPath?.objectives?.transferable?.length > 0 ||
    answer.whyThisResult?.length > 0;
  if (hasTakeaway) {
    stepper.push({ id: "takeaway", label: "Takeaway", icon: "🔄" });
  }

  const clampedIndex = Math.min(stepIndex, stepper.length - 1);
  const currentStep = stepper[clampedIndex];
  const isFirst = clampedIndex === 0;
  const isLast = clampedIndex === stepper.length - 1;

  const goPrev = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => setStepIndex((i) => Math.min(stepper.length - 1, i + 1));
  const goTo = (i) => setStepIndex(i);

  return (
    <div className="answer-view">
      {/* ─── Stepper progress indicator ───
          Single-row dot-and-connector bar. The fill line underneath is driven
          by --progress (percent of visited ground), so there's one source of
          truth instead of per-node pseudo-elements. The active step's label
          is called out below so "where am I?" is unambiguous. */}
      <nav
        className="answer-stepper"
        aria-label="Answer walkthrough progress"
        style={{
          "--progress":
            stepper.length > 1 ? `${(clampedIndex / (stepper.length - 1)) * 100}%` : "0%",
        }}
      >
        <ol className="stepper-track">
          {stepper.map((s, i) => {
            const state =
              i === clampedIndex ? "active" : i < clampedIndex ? "visited" : "upcoming";
            return (
              <li key={s.id} className={`stepper-node stepper-node-${state}`}>
                <button
                  type="button"
                  className="stepper-dot"
                  onClick={() => goTo(i)}
                  aria-current={i === clampedIndex ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${s.label}`}
                  title={s.label}
                >
                  {state === "visited" ? (
                    <span className="stepper-dot-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <span className="stepper-dot-num" aria-hidden="true">
                      {i + 1}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="stepper-caption">
          <span className="stepper-caption-counter">
            Step {clampedIndex + 1} of {stepper.length}
          </span>
          <span className="stepper-caption-label">
            <span className="stepper-caption-icon" aria-hidden="true">
              {currentStep.icon}
            </span>
            {currentStep.label}
          </span>
        </div>
      </nav>

      {/* ─── Active step content ─── */}
      <div className="answer-step-panel" key={currentStep.id}>
        {currentStep.id === "cause" && (
          <>
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
          </>
        )}

        {currentStep.id === "howItWorks" && (
          <div className="answer-section answer-how-it-works">
            <h3>
              <span className="section-icon">🧭</span> How This Works
            </h3>
            <p className="how-it-works-body">{cite(answer.howItWorks)}</p>
            {answer.diagram && <HowItWorksDiagram source={answer.diagram} />}
          </div>
        )}

        {currentStep.id === "verify" && (
          <div className="answer-section answer-fast-checks">
            <h3>
              <span className="section-icon">⚡</span> Verify The Pieces
            </h3>
            <ul>
              {answer.fastChecks.map((check, i) => {
                const { title, body } = splitTitle(check);
                return (
                  <li key={i}>
                    <span className="check-number">{i + 1}</span>
                    <div className="check-content">
                      {title && <strong className="check-title">{cite(title)}</strong>}
                      <span className="check-body">{cite(body)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {currentStep.id === "fix" && (
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
              <button
                type="button"
                className="fix-step-popout"
                onClick={openPopout}
                title="Open checklist in a resizable window"
                aria-label="Open Fix Steps in a new window"
              >
                ↗ Pop out
              </button>
            </h3>
            <ul className="fix-step-list">
              {answer.fixSteps.map((step, i) => {
                const checked = checkedSteps.has(i);
                const { title, body } = splitTitle(step);
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
                      <div className="fix-step-content">
                        {title && <strong className="fix-step-title">{cite(title)}</strong>}
                        <span className="fix-step-text">{cite(body)}</span>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
            {allStepsDone && (
              <div className="fix-steps-complete" role="status">
                🎉 Nice — every step tried. Did this resolve it? Let me know on the
                Takeaway step.
              </div>
            )}
          </div>
        )}

        {currentStep.id === "branches" && (
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

        {currentStep.id === "takeaway" && (
          <>
            {answer.learnPath?.objectives?.transferable?.length > 0 && (
              <div className="answer-section answer-skills">
                <h3>
                  <span className="section-icon">🔄</span> What you&apos;ll take away from this
                </h3>
                <p className="skills-intro">
                  Beyond fixing this specific issue, here&apos;s the transferable skill
                  you&apos;ll build:
                </p>
                <ul className="skills-list">
                  {answer.learnPath.objectives.transferable.map((skill, i) => (
                    <li key={i}>
                      <span>{cite(skill)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {answer.whyThisResult?.length > 0 && (
              <details className="answer-section answer-reasoning answer-reasoning-collapsible">
                <summary>
                  <span className="section-icon">💡</span>
                  <span className="reasoning-summary-label">
                    How the AI reached this conclusion
                  </span>
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

            <div className="answer-actions">
              <button className="answer-action-btn primary" onClick={onBackToVideos}>
                📚 Browse Related Resources
              </button>
              <button className="answer-action-btn secondary" onClick={onStartOver}>
                ← Ask Another Question
              </button>
            </div>

            <FeedbackPanel onFeedback={onFeedback} isRerunning={isRerunning} />
          </>
        )}
      </div>

      {/* ─── Stepper navigation ─── */}
      <div className="answer-stepper-nav">
        <button
          type="button"
          className="stepper-nav-btn stepper-nav-prev"
          onClick={goPrev}
          disabled={isFirst}
          aria-label="Previous section"
        >
          ← Previous
        </button>
        <span className="stepper-nav-counter">
          {clampedIndex + 1} of {stepper.length}
        </span>
        <button
          type="button"
          className="stepper-nav-btn stepper-nav-next"
          onClick={goNext}
          disabled={isLast}
          aria-label="Next section"
        >
          Next →
        </button>
      </div>

      {/* ─── Persistent reference material below the stepper ─── */}
      <EvidencePanel evidence={answer.evidence} />
      <OfficialDocsSummary data={vertexAIDocs} isLoading={vertexAILoading} error={vertexAIError} />
    </div>
  );
}

AnswerView.propTypes = {
  answer: PropTypes.shape({
    mostLikelyCause: PropTypes.string,
    confidence: PropTypes.oneOf(["high", "med", "low"]),
    howItWorks: PropTypes.string,
    diagram: PropTypes.string,
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
