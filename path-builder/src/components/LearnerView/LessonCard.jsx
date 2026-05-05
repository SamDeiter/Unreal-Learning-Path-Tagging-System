/**
 * LessonCard.jsx — Phase 5: Structured Lesson Card
 *
 * Renders a single learning path step in a consistent teaching layout:
 *   - Why This Matters
 *   - Do This Now (whatToDo actions)
 *   - Check It Worked (howToVerify)
 *   - Common Mistake
 *   - Key Takeaway
 *   - Go Deeper (links)
 *   - Inline video embed (YouTube/Drive) with graceful fallback
 *
 * Supports focused-step mode via `isFocused` prop for the unified
 * V2 learner flow (auto-expand, visual emphasis, scroll target).
 */

import { useState, forwardRef } from "react";
import { EngineDeltaChip } from "../EngineDeltaChip/EngineDeltaChip";
import { VideoSeries } from "../VideoSeries/VideoSeries";
import { useUserEngineVersion } from "../../hooks/useUserEngineVersion";
import videoEngineVersions from "../../data/video_engine_versions.json";
import "./LessonCard.css";

/** Format seconds → mm:ss */
function formatTime(sec) {
  if (!sec || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Completion type badges ─────────────────────────────────────────
const COMPLETION_BADGES = {
  read: { icon: "📖", label: "Read" },
  watch: { icon: "🎬", label: "Watch" },
  do: { icon: "🔧", label: "Do" },
  verify: { icon: "✅", label: "Verify" },
  apply: { icon: "🚀", label: "Apply" },
};

const LessonCard = forwardRef(function LessonCard(
  { step, index, isCompleted, onToggleComplete, isFocused = false },
  ref
) {
  const [manualExpand, setManualExpand] = useState(true);
  const [userVersion] = useUserEngineVersion();

  // When focused, always expanded; otherwise user-controlled
  const isExpanded = isFocused || manualExpand;

  if (!step) return null;

  const badge = COMPLETION_BADGES[step.completionType] || COMPLETION_BADGES.do;
  const hasStructuredContent = step.whatToDo?.length > 0 || step.howToVerify?.length > 0;

  const video = step.video || null;
  const hasVideo = video && (video.driveId || video.youtubeId);
  const isVideoStep = step.completionType === "watch" || step.source === "video" || !!step.video;

  // Resolve the videoId used by engineRefMentions: try every plausible field
  // across video-, doc-, and segment-shaped steps.
  const videoCode =
    video?.youtubeId
    || video?.courseCode
    || video?.code
    || step.source?.id
    || step.source?.code
    || step.source?.docId
    || step.code
    || step.courseCode
    || step._originalSegment?.id
    || step._originalSegment?.code
    || null;
  // engineVersion lookup may return null for doc steps — that's fine, the
  // useEngineDeltas hook treats null as "unknown" and surfaces changes
  // anyway when the user's version is at-or-past the change's `to`.
  const videoVersion = videoCode ? videoEngineVersions[videoCode] || null : null;

  return (
    <div
      ref={ref}
      className={`lesson-card ${isCompleted ? "lesson-card--completed" : ""} ${isFocused ? "lesson-card--focused" : ""}`}
    >
      {/* ── Header ── */}
      <div className="lesson-card__header" onClick={() => setManualExpand(!manualExpand)}>
        <div className="lesson-card__header-left">
          <button
            className="lesson-card__checkbox"
            onClick={(e) => { e.stopPropagation(); onToggleComplete?.(index); }}
            aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
          >
            {isCompleted ? "✅" : "⬜"}
          </button>
          <span className="lesson-card__number">{index + 1}</span>
          <h3 className="lesson-card__title">{step.title}</h3>
        </div>
        <div className="lesson-card__header-right">
          <span className="lesson-card__badge" title={badge.label}>
            {badge.icon} {badge.label}
          </span>
          {step.estimatedMinutes > 0 && (
            <span className="lesson-card__time">⏱ {step.estimatedMinutes}m</span>
          )}
          <span className="lesson-card__expand">{isExpanded ? "▾" : "▸"}</span>
        </div>
      </div>

      {/* Version-delta chip — surfaces verified engineRef mentions for this
          item. Both videoCode and videoTitle are tried; videoVersion may be
          null for docs; the resolver handles that. */}
      <EngineDeltaChip
        videoCode={videoCode}
        videoTitle={step.title}
        videoVersion={videoVersion}
        userVersion={userVersion}
      />

      {/* ── Body ── */}
      {isExpanded && (
        <div className="lesson-card__body">
          {/* Inline Video — FIRST for watch steps. Renders as a series when
              the step carries a `videos` array (multi-lesson courses), or as
              a single embed otherwise. */}
          {isVideoStep && ((Array.isArray(step.videos) && step.videos.length > 0) || hasVideo) && (
            <section className="lesson-card__section lesson-card__section--video">
              <h4 className="lesson-card__section-title">🎬 Video</h4>
              <VideoSeries
                videos={Array.isArray(step.videos) && step.videos.length > 0 ? step.videos : [video]}
                fallbackTitle={step.title}
              />
              {(video?.startSec > 0 || video?.endSec > 0) && (
                <div className="lesson-card__video-timestamp">
                  ⏱ {formatTime(video.startSec)} – {formatTime(video.endSec)}
                </div>
              )}
            </section>
          )}

          {/* Why This Matters */}
          {step.whyThisMatters && (
            <section className="lesson-card__section lesson-card__section--why">
              <h4 className="lesson-card__section-title">💡 Why This Matters</h4>
              <p>{step.whyThisMatters}</p>
            </section>
          )}

          {/* Summary fallback for non-enriched steps */}
          {!hasStructuredContent && step.summary && (
            <section className="lesson-card__section lesson-card__section--summary">
              <p>{step.summary}</p>
            </section>
          )}

          {/* Do This Now */}
          {step.whatToDo?.length > 0 && (
            <section className="lesson-card__section lesson-card__section--do">
              <h4 className="lesson-card__section-title">🔧 Do This Now</h4>
              <ol className="lesson-card__action-list">
                {step.whatToDo.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ol>
            </section>
          )}

          {/* Check It Worked */}
          {step.howToVerify?.length > 0 && (
            <section className="lesson-card__section lesson-card__section--verify">
              <h4 className="lesson-card__section-title">✅ Check It Worked</h4>
              <ul className="lesson-card__check-list">
                {step.howToVerify.map((check, i) => (
                  <li key={i}>{check}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Common Mistake */}
          {step.commonMistake && (
            <section className="lesson-card__section lesson-card__section--mistake">
              <h4 className="lesson-card__section-title">⚠️ Common Mistake</h4>
              <p>{step.commonMistake}</p>
            </section>
          )}

          {/* Key Takeaway */}
          {step.takeaway && (
            <section className="lesson-card__section lesson-card__section--takeaway">
              <h4 className="lesson-card__section-title">🎯 Key Takeaway</h4>
              <p className="lesson-card__takeaway">{step.takeaway}</p>
            </section>
          )}

          {/* Inline Video — AFTER content for non-watch steps */}
          {hasVideo && !isVideoStep && (
            <section className="lesson-card__section lesson-card__section--video">
              <h4 className="lesson-card__section-title">🎬 Video</h4>
              <div className="lesson-card__video">
                {video.driveId ? (
                  <iframe
                    src={`https://drive.google.com/file/d/${video.driveId}/preview`}
                    allow="autoplay"
                    allowFullScreen
                    title={video.videoTitle || step.title}
                    className="lesson-card__video-frame"
                  />
                ) : video.youtubeId ? (
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0&modestbranding=1${video.startSec ? `&start=${video.startSec}` : ""}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={video.videoTitle || step.title}
                    className="lesson-card__video-frame"
                  />
                ) : null}
                <div className="lesson-card__video-meta">
                  {video.videoTitle && <span>{video.videoTitle}</span>}
                  {(video.startSec > 0 || video.endSec > 0) && (
                    <span className="lesson-card__video-timestamp">
                      ⏱ {formatTime(video.startSec)} – {formatTime(video.endSec)}
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Video fallback for video-marked steps with no playable URL */}
          {!hasVideo && isVideoStep && (
            <section className="lesson-card__section lesson-card__section--video-fallback">
              <p className="lesson-card__video-fallback">
                🎬 This step references a video resource. Follow the instructions
                above, then check the "Go Deeper" links for related video content.
              </p>
            </section>
          )}

          {/* Go Deeper */}
          {step.goDeeper?.length > 0 && (
            <section className="lesson-card__section lesson-card__section--deeper">
              <h4 className="lesson-card__section-title">📚 Go Deeper</h4>
              <ul className="lesson-card__links">
                {step.goDeeper.map((link, i) => (
                  <li key={i}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                      {link.type === "video" ? "🎬" : "📄"} {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
});

export default LessonCard;
