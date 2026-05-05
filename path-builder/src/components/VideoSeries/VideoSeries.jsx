/**
 * VideoSeries — playlist renderer for courses with multiple videos.
 *
 * 67 of 2,436 courses in the library carry a `videos` array longer than 1.
 * They come in two flavors:
 *   - Series: sequential lessons with prefixes like 01_Intro / 02_Course Outline
 *   - Version variants: same lesson recorded for multiple UE versions
 *     (e.g. 01_Intro_55 / 01_Intro_53 / 01_Landscape_500)
 *
 * This component renders the active video in an iframe + a numbered playlist
 * below, parses the `_NN` UE-version suffix from filenames, and auto-selects
 * the entry that best matches the user's installed UE version.
 *
 * Chip rendering stays at the step/course level (in the parent component) —
 * mentions are keyed by course/doc IDs, not individual mp4 filenames.
 */
import { useEffect, useMemo, useState } from "react";
import { useUserEngineVersion } from "../../hooks/useUserEngineVersion";
import "./VideoSeries.css";

// Version suffix at the end of a filename stem. Optional trailing marker is
// strictly whitelisted so titles like "01_World_500_Pano.mp4" don't false-fire
// to "5.0" — the trailing token must be from the known revision-marker set.
const VERSION_TAIL_RE = /_v?(\d{2,3})(?:_(NEW|FIXED|OLD|FINAL|REV\d*))?$/i;

function stripExtension(filename) {
  return (filename || "").replace(/\.(mp4|mov|webm)$/i, "");
}

/** Parse "_55" / "_56" / "_500" / "_v55" suffix from a filename → "5.5" / "5.0". */
function parseVersionSuffix(filename) {
  if (!filename) return null;
  const stem = stripExtension(filename);
  const m = stem.match(VERSION_TAIL_RE);
  if (!m) return null;
  const raw = m[1];
  // 500 → 5.0, 55 → 5.5, 56 → 5.6. UE5 minor goes 0..8 today.
  if (raw.length === 3 && raw.startsWith("5")) return `5.${parseInt(raw[1], 10)}`;
  if (raw.length === 2 && raw.startsWith("5")) return `5.${raw[1]}`;
  return null;
}

/** Pretty title for a playlist entry — strip the courseCode prefix and version suffix. */
function prettyTitle(filename, fallback) {
  if (!filename) return fallback || "Lesson";
  let s = stripExtension(filename);
  s = s.replace(/^\d+\.\d+_/, ""); // course-code prefix like "219.01_"
  s = s.replace(/^\d+_/, "");      // bare lesson-num prefix like "01_"
  s = s.replace(VERSION_TAIL_RE, "")
       .replace(/_/g, " ")
       .trim();
  return s || fallback || "Lesson";
}

/** Compare semantic versions like "5.6" vs "5.7". Returns -1/0/1. */
function cmpVersion(a, b) {
  const pa = String(a || "").split(".").map(Number);
  const pb = String(b || "").split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function formatDuration(sec) {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function videoEmbedSrc(v) {
  // Accept both naming conventions: `drive_id` (course-library shape) and
  // `driveId` (step.video / enriched-step shape). Same for youtube.
  const driveId = v.drive_id || v.driveId;
  if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;
  const youtubeId = v.youtubeId || v.youtube_id;
  if (youtubeId) {
    const startParam = v.startSec ? `&start=${v.startSec}` : "";
    return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1${startParam}`;
  }
  // `videoUrl` is set by upstream enrichers (WebPlayerPreview) when the
  // course library only carried a free-text URL.
  if (v.videoUrl && /^https?:/i.test(v.videoUrl)) return v.videoUrl;
  if (v.path && /^https?:/i.test(v.path)) return v.path;
  return null;
}

/** Pick the playlist entry whose parsed version best matches `userVersion`.
 *  Strategy: exact match first, otherwise the highest version that is ≤ userVersion.
 *  Compares full major.minor (not minor-only), so 4.x or 6.x slipping in won't
 *  silently look like a 5.x match. */
function pickInitialIndex(items, userVersion) {
  if (!items.length) return 0;
  let exact = -1;
  let bestLEIdx = -1;
  let bestLEVer = null;
  for (let i = 0; i < items.length; i++) {
    const v = items[i].parsedVersion;
    if (!v) continue;
    if (v === userVersion) { exact = i; break; }
    if (cmpVersion(v, userVersion) <= 0 && (bestLEVer == null || cmpVersion(v, bestLEVer) > 0)) {
      bestLEVer = v;
      bestLEIdx = i;
    }
  }
  if (exact >= 0) return exact;
  if (bestLEIdx >= 0) return bestLEIdx;
  return 0;
}

export function VideoSeries({ videos, fallbackTitle }) {
  const [userVersion] = useUserEngineVersion();

  const items = useMemo(() => {
    if (!Array.isArray(videos)) return [];
    return videos.map((v, i) => ({
      ...v,
      idx: i,
      embedSrc: videoEmbedSrc(v),
      parsedVersion: parseVersionSuffix(v.name || v.path || ""),
      displayTitle: v.videoTitle || v.title || prettyTitle(v.name || v.path, fallbackTitle),
    })).filter((v) => v.embedSrc);
  }, [videos, fallbackTitle]);

  const initialIndex = useMemo(() => pickInitialIndex(items, userVersion), [items, userVersion]);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  // If the user changes their UE version while viewing a series, re-pick the
  // best-fit video. Without this, useState's lazy init meant the playlist
  // stayed stuck on whatever the version was at mount time.
  useEffect(() => {
    setActiveIndex(initialIndex);
  }, [initialIndex]);

  if (items.length === 0) return null;
  if (items.length === 1) {
    // Single-video case — no playlist UI, but keep the title meta below
    // so we don't lose it relative to the pre-VideoSeries renderers.
    const v = items[0];
    return (
      <div className="video-series video-series--single">
        <iframe
          className="video-series__embed"
          src={v.embedSrc}
          title={v.displayTitle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {(v.displayTitle || formatDuration(v.duration_seconds)) && (
          <div className="video-series__player-meta">
            {v.displayTitle && (
              <span className="video-series__player-title">{v.displayTitle}</span>
            )}
            {v.parsedVersion && (
              <span
                className={
                  v.parsedVersion === userVersion
                    ? "video-series__chip video-series__chip--match"
                    : "video-series__chip video-series__chip--mismatch"
                }
              >
                UE {v.parsedVersion}
              </span>
            )}
            {formatDuration(v.duration_seconds) && (
              <span className="video-series__player-duration">⏱ {formatDuration(v.duration_seconds)}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  const active = items[activeIndex] || items[0];

  return (
    <div className="video-series">
      <div className="video-series__player">
        <iframe
          key={active.idx}
          className="video-series__embed"
          src={active.embedSrc}
          title={active.displayTitle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <div className="video-series__player-meta">
          <span className="video-series__player-title">{active.displayTitle}</span>
          {active.parsedVersion && (
            <span
              className={
                active.parsedVersion === userVersion
                  ? "video-series__chip video-series__chip--match"
                  : "video-series__chip video-series__chip--mismatch"
              }
              title={
                active.parsedVersion === userVersion
                  ? `Recorded in your version (UE ${userVersion})`
                  : `Recorded in UE ${active.parsedVersion}; you're on UE ${userVersion}`
              }
            >
              UE {active.parsedVersion}
            </span>
          )}
          {formatDuration(active.duration_seconds) && (
            <span className="video-series__player-duration">⏱ {formatDuration(active.duration_seconds)}</span>
          )}
        </div>
      </div>
      <ol className="video-series__list" aria-label={`${items.length} videos in this lesson`}>
        {items.map((v, i) => (
          <li
            key={v.idx}
            className={`video-series__item ${i === activeIndex ? "is-active" : ""}`}
          >
            <button
              type="button"
              className="video-series__btn"
              onClick={() => setActiveIndex(i)}
              aria-current={i === activeIndex ? "true" : undefined}
            >
              <span className="video-series__num">{i + 1}</span>
              <span className="video-series__title">{v.displayTitle}</span>
              {v.parsedVersion && (
                <span
                  className={
                    v.parsedVersion === userVersion
                      ? "video-series__tag video-series__tag--match"
                      : "video-series__tag video-series__tag--mismatch"
                  }
                >
                  {v.parsedVersion}
                </span>
              )}
              {formatDuration(v.duration_seconds) && (
                <span className="video-series__dur">{formatDuration(v.duration_seconds)}</span>
              )}
            </button>
          </li>
        ))}
      </ol>
      <div className="video-series__nav">
        <button
          type="button"
          className="video-series__nav-btn"
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          disabled={activeIndex === 0}
        >
          ← Previous
        </button>
        <span className="video-series__progress">
          {activeIndex + 1} of {items.length}
        </span>
        <button
          type="button"
          className="video-series__nav-btn"
          onClick={() => setActiveIndex((i) => Math.min(items.length - 1, i + 1))}
          disabled={activeIndex === items.length - 1}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
