/**
 * PathWizard — Read-only completeness checklist for learning path quality
 *
 * Auto-evaluates content checks and structural checks.
 * Sign-off, Publish, and Export controls are in the Export tab.
 *
 * Content Checks:
 *   - Has prerequisites (foundation steps)
 *   - Has core steps (fix steps)
 *   - Has practice (transfer steps)
 *   - No high-severity gaps
 *   - Coverage ≥ 70%
 *
 * Structural Checks (research-backed):
 *   - Step count ≤ 7 (cognitive load)
 *   - No video > 6 min (engagement cliff)
 *   - Has bridge narrations (connections)
 */

import { useMemo } from "react";
import { evaluateChecks } from "../../services/pathChecks";

export default function PathWizard({ pathResult, gaps, onFixClick }) {
  const checks = useMemo(() => evaluateChecks(pathResult, gaps), [pathResult, gaps]);

  const contentChecks = checks.filter((c) => c.group === "content");
  const structureChecks = checks.filter((c) => c.group === "structure");
  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;
  const allPassed = passedCount === totalCount;
  const progressPct = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  if (!pathResult) return null;

  return (
    <div className="path-wizard" id="path-wizard">
      {/* Header */}
      <div className="path-wizard-header">
        <h2>
          <span>✅</span> Path Review
        </h2>
        <p>
          Verify your learning path meets quality standards before publishing. Checks are evaluated
          automatically from the path data and gap analysis.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="wizard-progress" id="wizard-progress">
        <div className="wizard-progress-bar">
          <div
            className={`wizard-progress-fill ${allPassed ? "complete" : "partial"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="wizard-progress-label">
          <span>
            {passedCount}/{totalCount} checks passed
          </span>
          <span>{progressPct}%</span>
        </div>
      </div>

      {/* Content Checks */}
      <div className="wizard-group">
        <h3 className="wizard-group-title">Content Checks</h3>
        {contentChecks.map((check) => (
          <div
            key={check.id}
            className={`wizard-check ${check.passed ? "passed" : "failed"}`}
            id={`wizard-check-${check.id}`}
          >
            <span className="wizard-check-icon">{check.passed ? "✅" : "❌"}</span>
            <div className="wizard-check-content">
              <div className="wizard-check-label">{check.label}</div>
              <div className="wizard-check-detail">{check.detail}</div>
              {!check.passed && check.fix && (
                <button
                  className="wizard-check-fix"
                  style={{
                    background: "none", border: "none", color: "#f59e0b",
                    cursor: onFixClick ? "pointer" : "default", padding: 0, fontSize: "inherit",
                    textAlign: "left",
                  }}
                  onClick={() => onFixClick?.(check.id)}
                  title={onFixClick ? "Click to jump to fix" : undefined}
                >
                  💡 {check.fix}{onFixClick ? " →" : ""}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Structural Checks */}
      <div className="wizard-group">
        <h3 className="wizard-group-title">Structural Checks (Research-backed)</h3>
        {structureChecks.map((check) => (
          <div
            key={check.id}
            className={`wizard-check ${check.passed ? "passed" : "failed"}`}
            id={`wizard-check-${check.id}`}
          >
            <span className="wizard-check-icon">{check.passed ? "✅" : "❌"}</span>
            <div className="wizard-check-content">
              <div className="wizard-check-label">{check.label}</div>
              <div className="wizard-check-detail">{check.detail}</div>
              {!check.passed && check.fix && (
                <button
                  className="wizard-check-fix"
                  style={{
                    background: "none", border: "none", color: "#f59e0b",
                    cursor: onFixClick ? "pointer" : "default", padding: 0, fontSize: "inherit",
                    textAlign: "left",
                  }}
                  onClick={() => onFixClick?.(check.id)}
                  title={onFixClick ? "Click to jump to fix" : undefined}
                >
                  💡 {check.fix}{onFixClick ? " →" : ""}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
