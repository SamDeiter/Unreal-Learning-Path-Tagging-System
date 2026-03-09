/**
 * PathWizard — Completeness checklist for learning path quality
 *
 * Auto-evaluates content checks, structural checks, and provides
 * a manual instructor sign-off toggle. Progress bar + gated Publish.
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
 *
 * Manual:
 *   - Instructor sign-off
 */

import { useState, useMemo } from "react";

/**
 * Run all checks and return results array.
 * Each check: { id, label, passed, detail, fix?, group }
 */
function evaluateChecks(pathResult, gaps) {
  const path = pathResult?.path || [];
  const bridges = pathResult?.bridges || [];
  const checks = [];

  // ── Content Checks ──────────────────────────────────────
  checks.push({
    id: "has-prerequisites",
    label: "Has prerequisite steps",
    passed: path.some((s) => s.category === "foundation"),
    detail: `${path.filter((s) => s.category === "foundation").length} foundation step(s)`,
    fix: !path.some((s) => s.category === "foundation")
      ? "Add a foundation step to teach prerequisites"
      : null,
    group: "content",
  });

  checks.push({
    id: "has-core",
    label: "Has core solution steps",
    passed: path.some((s) => s.category === "fix"),
    detail: `${path.filter((s) => s.category === "fix").length} fix step(s)`,
    fix: !path.some((s) => s.category === "fix")
      ? "Path needs at least one core solution step"
      : null,
    group: "content",
  });

  checks.push({
    id: "has-practice",
    label: "Has practice / transfer steps",
    passed: path.some((s) => s.category === "transfer"),
    detail: `${path.filter((s) => s.category === "transfer").length} transfer step(s)`,
    fix: !path.some((s) => s.category === "transfer")
      ? "Add a transfer step so learners can apply the concept"
      : null,
    group: "content",
  });

  const highGaps = (gaps?.blindSpots || []).filter((b) => b.severity === "high");
  checks.push({
    id: "no-high-gaps",
    label: "No high-severity gaps",
    passed: highGaps.length === 0,
    detail:
      highGaps.length === 0
        ? "No critical blind spots detected"
        : `${highGaps.length} high-severity gap(s): ${highGaps.map((g) => g.topic).join(", ")}`,
    fix: highGaps.length > 0 ? 'Use "Fill This Gap" to address critical gaps' : null,
    group: "content",
  });

  const coverageScore = gaps?.coverageScore ?? 1;
  checks.push({
    id: "coverage-threshold",
    label: "Coverage ≥ 70%",
    passed: coverageScore >= 0.7,
    detail: `${Math.round(coverageScore * 100)}% corpus coverage`,
    fix: coverageScore < 0.7 ? "Fill gaps or add more steps to improve coverage" : null,
    group: "content",
  });

  // ── Structural Checks ──────────────────────────────────
  checks.push({
    id: "step-count",
    label: "Step count ≤ 7",
    passed: path.length <= 7,
    detail: `${path.length} step(s) — ${path.length <= 7 ? "within cognitive load limit" : "exceeds 5-9 chunk capacity"}`,
    fix: path.length > 7 ? "Consider consolidating or removing lower-priority steps" : null,
    group: "structure",
  });

  // Video length check — best effort (check if segment has duration data)
  const longVideos = path.filter((s) => {
    const duration = s.segment?.duration || s.segment?.durationSeconds || 0;
    return duration > 360; // 6 minutes = 360 seconds
  });
  checks.push({
    id: "no-long-videos",
    label: "No video step > 6 minutes",
    passed: longVideos.length === 0,
    detail:
      longVideos.length === 0
        ? "All video segments within engagement window"
        : `${longVideos.length} step(s) exceed 6-minute engagement cliff`,
    fix:
      longVideos.length > 0
        ? "Consider splitting long videos into shorter segments (3-5 min)"
        : null,
    group: "structure",
  });

  checks.push({
    id: "has-bridges",
    label: "Has bridge narrations",
    passed: bridges.length > 0 && bridges.some((b) => b.text && b.text.length > 0),
    detail:
      bridges.length > 0
        ? `${bridges.filter((b) => b.text).length} bridge narration(s)`
        : "No bridge narrations generated",
    fix:
      bridges.length === 0 || !bridges.some((b) => b.text)
        ? "Bridge narrations help connect steps — try regenerating the path"
        : null,
    group: "structure",
  });

  return checks;
}

export default function PathWizard({ pathResult, gaps }) {
  const [signedOff, setSignedOff] = useState(false);
  const [published, setPublished] = useState(false);

  const checks = useMemo(() => evaluateChecks(pathResult, gaps), [pathResult, gaps]);

  const contentChecks = checks.filter((c) => c.group === "content");
  const structureChecks = checks.filter((c) => c.group === "structure");
  const passedCount = checks.filter((c) => c.passed).length + (signedOff ? 1 : 0);
  const totalCount = checks.length + 1; // +1 for sign-off
  const allPassed = passedCount === totalCount;
  const progressPct = Math.round((passedCount / totalCount) * 100);

  const handlePublish = () => {
    if (!allPassed) return;
    setPublished(true);
    // Future: trigger SCORM export, analytics tracking, etc.
  };

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
              {!check.passed && check.fix && <div className="wizard-check-fix">💡 {check.fix}</div>}
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
              {!check.passed && check.fix && <div className="wizard-check-fix">💡 {check.fix}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Manual Sign-off */}
      <div className="wizard-group">
        <h3 className="wizard-group-title">Manual Review</h3>
        <div
          className="wizard-manual-toggle"
          onClick={() => setSignedOff(!signedOff)}
          role="switch"
          aria-checked={signedOff}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSignedOff(!signedOff);
            }
          }}
          id="instructor-signoff-toggle"
        >
          <div className={`wizard-toggle-switch ${signedOff ? "on" : ""}`} />
          <div>
            <div className="wizard-toggle-label">Instructor Sign-off</div>
            <div className="wizard-toggle-desc">
              I have reviewed the path content and confirm it meets quality standards
            </div>
          </div>
        </div>
      </div>

      {/* Publish */}
      <div className="wizard-publish-area" id="wizard-publish-area">
        {published ? (
          <div className="wizard-success-toast" id="publish-success-toast">
            🎉 Path published successfully!
          </div>
        ) : (
          <>
            <button
              className={`wizard-publish-btn ${allPassed ? "ready" : "locked"}`}
              onClick={handlePublish}
              disabled={!allPassed}
              id="wizard-publish-btn"
            >
              {allPassed ? "🚀 Publish Path" : "🔒 Publish Path"}
            </button>
            {!allPassed && (
              <p className="wizard-publish-hint">
                Complete all checks and sign off to enable publishing
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
