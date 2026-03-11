/**
 * pathChecks.js — Evaluate learning path quality checks
 *
 * Shared between PathWizard (read-only display) and
 * PathIntelligencePanel Export tab (gated publish).
 */

/**
 * Run all checks and return results array.
 * Each check: { id, label, passed, detail, fix?, group }
 */
export function evaluateChecks(pathResult, gaps) {
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
      ? "Go to the Gaps tab and add a Beginner-level foundation step"
      : null,
    group: "content",
  });

  checks.push({
    id: "has-core",
    label: "Has core solution steps",
    passed: path.some((s) => s.category === "fix"),
    detail: `${path.filter((s) => s.category === "fix").length} fix step(s)`,
    fix: !path.some((s) => s.category === "fix")
      ? "Go to the Gaps tab and use Fill This Gap to add a core solution step"
      : null,
    group: "content",
  });

  checks.push({
    id: "has-practice",
    label: "Has practice / transfer steps",
    passed: path.some((s) => s.category === "transfer"),
    detail: `${path.filter((s) => s.category === "transfer").length} transfer step(s)`,
    fix: !path.some((s) => s.category === "transfer")
      ? "Go to the Gaps tab and add a hands-on exercise or project step"
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
    fix: highGaps.length > 0 ? "Go to the Gaps tab and use Fill This Gap for each critical gap" : null,
    group: "content",
  });

  const coverageScore = gaps?.coverageScore ?? 1;
  checks.push({
    id: "coverage-threshold",
    label: "Coverage ≥ 70%",
    passed: coverageScore >= 0.7,
    detail: `${Math.round(coverageScore * 100)}% corpus coverage`,
    fix: coverageScore < 0.7 ? "Go to the Gaps tab — fill gaps or add more steps to improve coverage" : null,
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

  const longVideos = path.filter((s) => {
    const duration = s.segment?.duration || s.segment?.durationSeconds || 0;
    return duration > 360;
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
    passed: bridges.length > 0 && bridges.some((b) => b.text),
    detail:
      bridges.length > 0 && bridges.some((b) => b.text)
        ? `${bridges.filter((b) => b.text).length} bridge(s) connecting steps`
        : "No bridge narrations found",
    fix:
      bridges.length === 0 || !bridges.some((b) => b.text)
        ? "Bridge narrations help connect steps — try regenerating the path"
        : null,
    group: "structure",
  });

  // ── Verification Checks ────────────────────────────────
  const unverified = path.filter((s) => !s.verified || s.verified === "unverified").length;
  const rejected = path.filter((s) => s.verified === "rejected").length;
  checks.push({
    id: "all-verified",
    label: "All steps reviewed",
    passed: unverified === 0 && rejected === 0 && path.length > 0,
    detail:
      unverified === 0 && rejected === 0
        ? "All steps have been approved"
        : `${unverified} still need review, ${rejected} flagged`,
    fix: unverified > 0 || rejected > 0
      ? "Go to the Review tab and approve or flag each step in your path"
      : null,
    group: "verification",
  });

  return checks;
}
