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

// Claude often prefixes list items with a markdown-bold title like
// `**Check Project Settings for Jump Action Mapping:** Go to ...`.
// Rendering that inline just makes each item visually heavier; splitting
// it into a title + body block gives the list real hierarchy.
function splitTitle(text) {
  if (!text || typeof text !== "string") return { title: null, body: text };
  const m = text.match(/^\s*\*\*([^*\n]+?)\*\*\s*/);
  if (!m) return { title: null, body: text };
  let title = m[1].trim();
  title = title.replace(/^\d+\.\s*/, ""); // drop "N. " — the list already numbers
  title = title.replace(/[:：]\s*$/, ""); // drop trailing colon, ASCII or full-width
  return { title, body: text.slice(m[0].length) };
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

// Popup-only renderer for the Fix Steps checklist. Opens a compact window
// sized to fit the list; checkboxes postMessage back to the opener so
// sessionStorage state stays synced with the main view.
function openFixStepsPopout({ steps, checked }) {
  if (typeof window === "undefined") return null;
  const estimatedHeight = Math.min(820, 160 + steps.length * 78);
  const popup = window.open(
    "",
    "fixStepsPopout",
    `width=560,height=${estimatedHeight},resizable=yes,scrollbars=yes`
  );
  if (!popup) return null;

  const splitSteps = steps.map(splitTitle);
  const stepsJSON = JSON.stringify(splitSteps);
  const checkedJSON = JSON.stringify([...checked]);

  popup.document.open();
  popup.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Fix Steps</title>
<style>
  :root { color-scheme: dark; }
  body {
    background: #0f172a;
    color: #e5e7eb;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    margin: 0;
    padding: 18px 20px;
  }
  h1 {
    font-size: 1rem;
    margin: 0 0 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
  }
  h1 .progress {
    margin-left: auto;
    font-size: 0.78rem;
    font-weight: 500;
    color: #94a3b8;
    background: rgba(148,163,184,0.08);
    padding: 2px 10px;
    border-radius: 10px;
  }
  ul { list-style: none; padding: 0; margin: 0; }
  li {
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: opacity 0.2s ease;
  }
  li:last-child { border-bottom: none; }
  label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 4px;
    cursor: pointer;
    user-select: none;
  }
  input[type="checkbox"] {
    margin: 3px 0 0;
    width: 16px;
    height: 16px;
    accent-color: #8b5cf6;
    cursor: pointer;
    flex-shrink: 0;
  }
  .num {
    font-size: 0.78rem;
    font-weight: 700;
    color: #a78bfa;
    min-width: 18px;
    padding-top: 1px;
    flex-shrink: 0;
    transition: color 0.2s ease;
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
  }
  .title {
    font-size: 0.92rem;
    font-weight: 600;
    color: #f3f4f6;
    line-height: 1.3;
  }
  .text {
    font-size: 0.88rem;
    line-height: 1.5;
    color: rgba(229,231,235,0.85);
    transition: color 0.2s ease;
  }
  li.checked { opacity: 0.7; }
  li.checked .title,
  li.checked .text {
    text-decoration: line-through;
    text-decoration-color: rgba(107,114,128,0.6);
    color: #6b7280;
  }
  li.checked .num { color: #4b5563; }
</style>
</head>
<body>
<h1><span>🔧</span><span>Fix Steps</span><span class="progress" id="progress"></span></h1>
<ul id="list"></ul>
<script>
const steps = ${stepsJSON};
const checked = new Set(${checkedJSON});
const list = document.getElementById('list');
const progress = document.getElementById('progress');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}

function render() {
  list.innerHTML = steps.map((step, i) => {
    const isChecked = checked.has(i);
    const titleHtml = step.title
      ? '<strong class="title">' + escapeHtml(step.title) + '</strong>'
      : '';
    return '<li class="' + (isChecked ? 'checked' : '') + '">'
      + '<label>'
      + '<input type="checkbox" data-i="' + i + '"' + (isChecked ? ' checked' : '') + '/>'
      + '<span class="num">' + (i + 1) + '</span>'
      + '<div class="content">'
      + titleHtml
      + '<span class="text">' + escapeHtml(step.body) + '</span>'
      + '</div>'
      + '</label></li>';
  }).join('');
  progress.textContent = checked.size + ' of ' + steps.length + ' done';
}

list.addEventListener('change', (e) => {
  const i = Number(e.target.dataset.i);
  if (Number.isNaN(i)) return;
  if (checked.has(i)) checked.delete(i); else checked.add(i);
  render();
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type: 'fixStepsToggle', index: i }, '*');
  }
});

// Opener can push state changes back so this view doesn't go stale.
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.type !== 'fixStepsSync' || !Array.isArray(d.checked)) return;
  checked.clear();
  d.checked.forEach(i => checked.add(i));
  render();
});

render();

// Auto-fit window to actual content once laid out.
window.addEventListener('load', () => {
  const contentHeight = document.documentElement.scrollHeight;
  const chrome = window.outerHeight - window.innerHeight;
  const target = Math.min(contentHeight + chrome + 8, screen.availHeight - 40);
  window.resizeTo(window.outerWidth, target);
});
</script>
</body>
</html>`);
  popup.document.close();
  return popup;
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

      {/* ─── How It Works (concept primer before verification) ─── */}
      {answer.howItWorks && (
        <div className="answer-section answer-how-it-works">
          <h3>
            <span className="section-icon">🧭</span> How This Works
          </h3>
          <p className="how-it-works-body">{cite(answer.howItWorks)}</p>
          {answer.diagram && <HowItWorksDiagram source={answer.diagram} />}
        </div>
      )}

      {/* ─── Verify The Pieces (existence / wiring checks tied to howItWorks) ─── */}
      {answer.fastChecks?.length > 0 && (
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
              <li key={i}>
                <span>{cite(skill)}</span>
              </li>
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
