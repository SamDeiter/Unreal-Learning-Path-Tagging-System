import PropTypes from "prop-types";
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
 * matched tags ("Covers: ..."), and an add/remove toggle.
 */
export default function VideoResultCard({ video, isAdded, onToggle }) {
  const { title, courseName, duration, matchedTags = [], driveId } = video;

  // Fallback thumbnail — Drive thumbnails are currently broken,
  // so we use a gradient placeholder with a play icon
  const thumbnailUrl = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w320` : null;

  return (
    <div className={`video-result-card ${isAdded ? "added" : ""}`}>
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
          <span className="vrc-play-icon">▶</span>
        </div>
        {duration > 0 && <span className="vrc-duration">{formatDuration(duration)}</span>}
      </div>

      <div className="vrc-info">
        <h4 className="vrc-title">{title}</h4>
        {courseName && <p className="vrc-course">{courseName}</p>}
        {matchedTags.length > 0 && (
          <p className="vrc-tags">Covers: {matchedTags.slice(0, 3).join(", ")}</p>
        )}
      </div>

      <button
        className={`vrc-add-btn ${isAdded ? "vrc-added" : ""}`}
        onClick={() => onToggle(video)}
        aria-label={isAdded ? "Remove from playlist" : "Add to playlist"}
      >
        {isAdded ? "✓ Added" : "+ Add"}
      </button>
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
  }).isRequired,
  isAdded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
};
