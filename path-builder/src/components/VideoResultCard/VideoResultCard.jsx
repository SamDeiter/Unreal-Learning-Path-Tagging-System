import { useState } from "react";
import PropTypes from "prop-types";
import { PlayCircle, Check, Plus, Clock } from "lucide-react";
import { recordUpvote, recordDownvote, getFeedbackStatus } from "../../services/feedbackService";
import "./VideoResultCard.css";

/**
 * Formats seconds into a human-readable duration string.
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 1) return "<1 min";
  return `${mins} min`;
}

/**
 * Individual video result card — shows thumbnail, title, duration,
 * matched tags, timestamp hints, doc links, feedback, and an add/remove toggle.
 */
export default function VideoResultCard({ video, isAdded, onToggle, userQuery }) {
  const {
    title,
    courseName,
    duration,
    matchedTags = [],
    driveId,
    topSegments = [],
    _curatedMatch,
  } = video;

  const [feedbackState, setFeedbackState] = useState(() => getFeedbackStatus(driveId));

  const handleUpvote = (e) => {
    e.stopPropagation();
    recordUpvote(driveId, userQuery || "");
    setFeedbackState("up");
  };

  const handleDownvote = (e) => {
    e.stopPropagation();
    recordDownvote(driveId, userQuery || "");
    setFeedbackState("down");
  };

  // Fallback thumbnail
  const thumbnailUrl = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w320` : null;

  return (
    <div
      className={`video-result-card ${isAdded ? "added" : ""} ${_curatedMatch ? "curated" : ""} ${feedbackState === "down" ? "demoted" : ""}`}
    >
      <div className="vrc-thumbnail">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div className="vrc-thumb-fallback" style={{ display: thumbnailUrl ? "none" : "flex" }}>
          <span className="vrc-play-icon">
            <PlayCircle size={24} />
          </span>
        </div>
        {duration > 0 && <span className="vrc-duration">{formatDuration(duration)}</span>}
      </div>

      {_curatedMatch && <div className="vrc-curated-badge">✓ Known Solution</div>}

      <div className="vrc-info">
        <h4 className="vrc-title">{title}</h4>
        {courseName && <p className="vrc-course">{courseName}</p>}
        {matchedTags.length > 0 && (
          <p className="vrc-tags">Covers: {matchedTags.slice(0, 3).join(", ")}</p>
        )}

        {/* Timestamp segments — show WHERE in the video */}
        {topSegments.length > 0 && (
          <div className="vrc-segments">
            {topSegments.slice(0, 2).map((seg, idx) => (
              <div key={idx} className="vrc-segment-hint">
                <Clock size={12} className="vrc-clock-icon" />
                <span className="vrc-seg-time">{seg.timestamp}</span>
                <span className="vrc-seg-preview">
                  {seg.previewText.length > 55
                    ? seg.previewText.substring(0, 52) + "..."
                    : seg.previewText}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions row: feedback + add/remove */}
      <div className="vrc-actions">
        <div className="vrc-feedback">
          <button
            className={`vrc-fb-btn ${feedbackState === "up" ? "active-up" : ""}`}
            onClick={handleUpvote}
            aria-label="Helpful"
            title="This was helpful"
          >
            <span className="vrc-fb-emoji">👍</span>
          </button>
          <button
            className={`vrc-fb-btn ${feedbackState === "down" ? "active-down" : ""}`}
            onClick={handleDownvote}
            aria-label="Not helpful"
            title="Not relevant"
          >
            <span className="vrc-fb-emoji">👎</span>
          </button>
        </div>

        <button
          className={`vrc-add-btn ${isAdded ? "vrc-added" : ""}`}
          onClick={() => onToggle(video)}
          aria-label={isAdded ? "Remove from playlist" : "Add to playlist"}
        >
          {isAdded ? (
            <>
              <Check size={14} /> Added
            </>
          ) : (
            <>
              <Plus size={14} /> Add
            </>
          )}
        </button>
      </div>
    </div>
  );
}

VideoResultCard.propTypes = {
  video: PropTypes.shape({
    driveId: PropTypes.string,
    title: PropTypes.string.isRequired,
    courseName: PropTypes.string,
    duration: PropTypes.number,
    matchedTags: PropTypes.arrayOf(PropTypes.string),
    courseCode: PropTypes.string,
    topSegments: PropTypes.array,
    docLinks: PropTypes.array,
    _curatedMatch: PropTypes.bool,
  }).isRequired,
  isAdded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  userQuery: PropTypes.string,
};
