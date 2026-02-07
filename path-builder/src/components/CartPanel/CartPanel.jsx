import PropTypes from "prop-types";
import { cleanVideoTitle } from "../../utils/cleanVideoTitle";
import "./CartPanel.css";

/**
 * Format minutes into a readable string.
 */
function formatMinutes(totalSeconds) {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 1) return "<1 min";
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainder = mins % 60;
    return remainder > 0 ? `${hrs}h ${remainder}m` : `${hrs}h`;
  }
  return `${mins} min`;
}

/**
 * Sticky cart sidebar — always visible, shows video count,
 * total learning time, and a Watch Path CTA.
 */
export default function CartPanel({ cart, onRemove, onClear, onWatchPath }) {
  const totalDuration = cart.reduce((sum, v) => sum + (v.duration || 0), 0);

  return (
    <div className="cart-panel">
      <div className="cart-header">
        <h3 className="cart-title">🛒 My Playlist</h3>
        {cart.length > 0 && (
          <button className="cart-clear-btn" onClick={onClear} title="Clear all">
            Clear
          </button>
        )}
      </div>

      {cart.length > 0 ? (
        <>
          <div className="cart-stats">
            <span className="cart-stat-count">
              {cart.length} video{cart.length !== 1 ? "s" : ""}
            </span>
            <span className="cart-stat-dot">·</span>
            <span className="cart-stat-time">{formatMinutes(totalDuration)}</span>
          </div>

          {totalDuration > 28800 && (
            <div className="cart-warning">
              ⚠️ That's over 8 hours of content — consider narrowing your focus to the most relevant
              videos.
            </div>
          )}

          <div className="cart-items">
            {cart.map((video, index) => (
              <div key={video.driveId || index} className="cart-item">
                <span className="cart-item-num">{index + 1}</span>
                <div className="cart-item-info">
                  <span className="cart-item-title">{cleanVideoTitle(video.title)}</span>
                  {video.duration > 0 && (
                    <span className="cart-item-dur">{formatMinutes(video.duration)}</span>
                  )}
                </div>
                <button
                  className="cart-item-remove"
                  onClick={() => onRemove(video.driveId)}
                  aria-label={`Remove ${video.title}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button className="cart-watch-btn" onClick={onWatchPath}>
            ▶ Watch Path
          </button>
        </>
      ) : (
        <div className="cart-empty">
          <span className="cart-empty-icon">📺</span>
          <p>Search and add videos to build your learning path</p>
        </div>
      )}
    </div>
  );
}

CartPanel.propTypes = {
  cart: PropTypes.arrayOf(
    PropTypes.shape({
      driveId: PropTypes.string,
      title: PropTypes.string.isRequired,
      duration: PropTypes.number,
    })
  ).isRequired,
  onRemove: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  onWatchPath: PropTypes.func.isRequired,
};
