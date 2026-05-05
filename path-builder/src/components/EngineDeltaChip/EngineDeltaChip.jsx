/**
 * EngineDeltaChip — "⚠️ N changes since 5.6" chip + expandable delta list.
 *
 * Visual style mirrors the existing struggle-badge pattern for warning chips
 * (BespokePath/PathStep.jsx) and the unverified-banner expanded callout.
 *
 * Props:
 *   videoCode    — course code or YouTube ID (matches engineRefMentions.videoId)
 *   videoVersion — UE version the video was recorded in (e.g. "5.6")
 *   userVersion  — UE version the learner is on (e.g. "5.7")
 *
 * Renders nothing if userVersion <= videoVersion or no deltas resolve.
 */
import { useMemo, useState } from "react";
import { resolveEngineDeltas } from "../../utils/engineDeltaResolver";
import "./EngineDeltaChip.css";

function formatTime(sec) {
  if (sec == null || sec < 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function EngineDeltaChip({ videoCode, videoTitle, videoVersion, userVersion }) {
  const [expanded, setExpanded] = useState(false);
  const deltas = useMemo(
    () => resolveEngineDeltas({ videoCode, videoTitle, videoVersion, userVersion }),
    [videoCode, videoTitle, videoVersion, userVersion],
  );

  if (deltas.length === 0) return null;

  const breakingCount = deltas.filter((d) => d.severity === "breaking").length;
  const total = deltas.length;
  const totalLabel = `${total} change${total === 1 ? "" : "s"}`;
  const breakingLabel = breakingCount > 0 ? `${breakingCount} breaking, ${totalLabel}` : totalLabel;
  // When the video has a known engineVersion show "5.6 → 5.7", otherwise
  // fall back to "Updates for 5.7" so we don't display "null → 5.7".
  const label = videoVersion
    ? `${videoVersion} → ${userVersion}: ${breakingLabel}`
    : `Updates for UE ${userVersion}: ${breakingLabel}`;

  return (
    <div className="engine-delta-chip-wrap">
      <button
        type="button"
        className={`engine-delta-chip ${breakingCount ? "is-breaking" : "is-minor"}`}
        title={`This video predates UE ${userVersion}; click to see what changed.`}
        aria-expanded={expanded}
        aria-controls="engine-delta-list"
        onClick={() => setExpanded((v) => !v)}
      >
        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
        <span>{label}</span>
        <i
          className={`fa-solid fa-caret-${expanded ? "up" : "down"}`}
          aria-hidden="true"
          style={{ marginLeft: 4 }}
        />
      </button>
      {expanded && (
        <ul id="engine-delta-list" className="engine-delta-list">
          {deltas.map((d) => (
            <li key={d.mentionId} className="engine-delta-row">
              <div className="engine-delta-row__head">
                <span className="engine-delta-row__name">{d.canonicalName}</span>
                <span className={`engine-delta-row__pill engine-delta-row__pill--${d.severity}`}>
                  {d.changeType}
                </span>
                {formatTime(d.timestampSec) && (
                  <span className="engine-delta-row__ts">@ {formatTime(d.timestampSec)}</span>
                )}
              </div>
              {d.summary && <div className="engine-delta-row__summary">{d.summary}</div>}
              {d.replacement && (
                <div className="engine-delta-row__replacement">
                  <strong>Now use:</strong> {d.replacement}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
