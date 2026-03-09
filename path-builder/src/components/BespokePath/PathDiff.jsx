/**
 * PathDiff — Before/After comparison when gaps are filled
 *
 * Shows a step-by-step diff of the original path vs the updated path
 * after "Fill This Gap" inserts new steps. Added steps are highlighted
 * in green; original steps are dimmed. Coverage delta is shown.
 *
 * Props:
 *   originalSteps  — The path steps before any fills (snapshot)
 *   currentSteps   — The current path steps (may have added steps)
 *   originalCoverage — Coverage score before fills (0-1)
 *   currentCoverage  — Coverage score after fills (0-1)
 */

import { useMemo } from "react";
import { cleanVideoTitle } from "../../utils/cleanVideoTitle";

export default function PathDiff({
  originalSteps = [],
  currentSteps = [],
  originalCoverage = 0,
  currentCoverage = 0,
}) {
  // Build diff: mark each current step as "unchanged" or "added"
  const diff = useMemo(() => {
    if (!currentSteps || currentSteps.length === 0) return [];

    const originalCount = originalSteps?.length || 0;

    return currentSteps.map((step, i) => {
      const title =
        step.title ||
        cleanVideoTitle(step.segment?.title || step.segment?.videoTitle) ||
        `Step ${i + 1}`;
      const category = step.category || "core";
      const isAdded = i >= originalCount;

      return { title, category, isAdded, index: i };
    });
  }, [originalSteps, currentSteps]);

  // Coverage delta
  const coverageDelta = Math.round((currentCoverage - originalCoverage) * 100);
  const addedCount = diff.filter((d) => d.isAdded).length;

  if (!currentSteps || currentSteps.length === 0) {
    return (
      <div className="path-diff">
        <div className="path-diff-empty">
          <i className="fa-solid fa-code-compare"></i>
          <div>No path data to compare yet.</div>
          <div style={{ fontSize: "0.8rem", marginTop: "8px", opacity: 0.6 }}>
            Use &quot;Fill This Gap&quot; in the Gap Analysis card to add steps, then view the diff
            here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="path-diff" id="path-diff-view">
      <div className="path-diff-header">
        <h2>
          <i className="fa-solid fa-code-compare" style={{ marginRight: "8px", opacity: 0.7 }}></i>
          Path Changes
        </h2>
        <div className="path-diff-delta">
          {addedCount > 0 && (
            <span className="path-diff-delta-badge positive">
              <i className="fa-solid fa-plus"></i>
              {addedCount} step{addedCount !== 1 ? "s" : ""} added
            </span>
          )}
          {coverageDelta !== 0 && (
            <span className={`path-diff-delta-badge ${coverageDelta > 0 ? "positive" : "neutral"}`}>
              {coverageDelta > 0 ? "+" : ""}
              {coverageDelta}% coverage
            </span>
          )}
          {addedCount === 0 && <span className="path-diff-delta-badge neutral">No changes</span>}
        </div>
      </div>

      <div className="path-diff-steps">
        {diff.map((item) => (
          <div
            key={item.index}
            className={`path-diff-step ${item.isAdded ? "added" : "unchanged"}`}
            id={`diff-step-${item.index}`}
          >
            <div className="path-diff-step-index">{item.index + 1}</div>
            <div className="path-diff-step-title">
              {item.isAdded && (
                <i
                  className="fa-solid fa-plus path-diff-step-icon"
                  style={{ marginRight: "6px" }}
                ></i>
              )}
              {item.title}
            </div>
            <span className="path-diff-step-category">{item.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
