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

  // Only show checks that FAILED within each group
  const failedContent = contentChecks.filter((c) => !c.passed);
  const failedStructure = structureChecks.filter((c) => !c.passed);

  if (!pathResult) return null;

  return (
    <div className="path-wizard" id="path-wizard">
      {/* Header */}
      <div className="path-wizard-header">
        <h2>
          <span>{allPassed ? "🎉" : "✅"}</span> Path Review
        </h2>
        <p>
          {allPassed
            ? "All quality checks pass! Your path is ready to export."
            : "Verify your learning path meets quality standards before publishing. Checks are evaluated automatically from the path data and gap analysis."}
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

      {/* All Passed — success state */}
      {allPassed && (
        <div style={{
          textAlign: "center", padding: "1.5rem 1rem",
          color: "#3fb950", fontSize: "0.9rem",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎉</div>
          <strong>All checks passed!</strong>
          <p style={{ color: "var(--fg-muted, #8b949e)", marginTop: "0.5rem", fontSize: "0.8rem" }}>
            Head to the Export tab to package your learning path.
          </p>
        </div>
      )}

      {/* Content Checks — only show if there are failures */}
      {failedContent.length > 0 && (
        <div className="wizard-group">
          <h3 className="wizard-group-title">Content Checks</h3>
          {failedContent.map((check) => (
            <div
              key={check.id}
              className="wizard-check failed"
              id={`wizard-check-${check.id}`}
            >
              <span className="wizard-check-icon">❌</span>
              <div className="wizard-check-content">
                <div className="wizard-check-label">{check.label}</div>
                <div className="wizard-check-detail">{check.detail}</div>
                {check.fix && (
                  <button
                    className="wizard-check-fix"
                    style={{
                      background: "none", border: "none", color: "#f59e0b",
                      cursor: "pointer", padding: 0, fontSize: "inherit",
                      textAlign: "left",
                    }}
                    onClick={() => onFixClick?.(check.id)}
                    title="Click to jump to fix"
                  >
                    💡 {check.fix} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Structural Checks — only show if there are failures */}
      {failedStructure.length > 0 && (
        <div className="wizard-group">
          <h3 className="wizard-group-title">Structural Checks (Research-backed)</h3>
          {failedStructure.map((check) => (
            <div
              key={check.id}
              className="wizard-check failed"
              id={`wizard-check-${check.id}`}
            >
              <span className="wizard-check-icon">❌</span>
              <div className="wizard-check-content">
                <div className="wizard-check-label">{check.label}</div>
                <div className="wizard-check-detail">{check.detail}</div>
                {check.fix && (
                  <button
                    className="wizard-check-fix"
                    style={{
                      background: "none", border: "none", color: "#f59e0b",
                      cursor: "pointer", padding: 0, fontSize: "inherit",
                      textAlign: "left",
                    }}
                    onClick={() => onFixClick?.(check.id)}
                    title="Click to jump to fix"
                  >
                    💡 {check.fix} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Passed checks summary — compact list when there are some failures */}
      {!allPassed && (passedCount > 0) && (
        <div className="wizard-group" style={{ opacity: 0.6 }}>
          <h3 className="wizard-group-title" style={{ fontSize: "0.75rem" }}>
            ✅ {passedCount} check{passedCount > 1 ? "s" : ""} passing
          </h3>
          <div style={{ fontSize: "0.75rem", color: "var(--fg-muted, #8b949e)", padding: "0 0.5rem" }}>
            {checks.filter(c => c.passed).map(c => c.label).join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

