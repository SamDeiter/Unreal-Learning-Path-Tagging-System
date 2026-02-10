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

/** Type icon map */
const TYPE_ICONS = { video: "📺", doc: "📖", youtube: "▶️" };

/**
 * Sticky cart sidebar — shows video/doc/YouTube items,
 * total learning time, and a Watch Path CTA.
 */
export default function CartPanel({ cart, onRemove, onClear, onWatchPath }) {
  const totalDuration = cart.reduce(
    (sum, v) => sum + (v.duration || (v.readTimeMinutes || v.durationMinutes || 0) * 60),
    0
  );
  const videoCount = cart.filter((i) => (i.type || "video") === "video").length;
  const docCount = cart.filter((i) => i.type === "doc").length;
  const ytCount = cart.filter((i) => i.type === "youtube").length;

  /** Build human-readable stat segments */
  const statParts = [];
  if (videoCount > 0) statParts.push(`${videoCount} video${videoCount !== 1 ? "s" : ""}`);
  if (docCount > 0) statParts.push(`${docCount} doc${docCount !== 1 ? "s" : ""}`);
  if (ytCount > 0) statParts.push(`${ytCount} YT`);

  return (
    <div className="cart-panel">
      <div className="cart-header">
        <h3 className="cart-title">🛒 My Learning Path</h3>
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
              {statParts.join(" · ")}
            </span>
            <span className="cart-stat-dot">·</span>
            <span className="cart-stat-time">{formatMinutes(totalDuration)}</span>
          </div>

          {totalDuration > 28800 && (
            <div className="cart-warning">
              ⚠️ That&apos;s over 8 hours of content — consider narrowing your focus to the most relevant
              items.
            </div>
          )}

          <div className="cart-items">
            {cart.map((item, index) => {
              const itemId = item.itemId || item.driveId || index;
              const itemType = item.type || "video";
              const icon = TYPE_ICONS[itemType] || "📺";
              const displayTitle =
                itemType === "video" ? cleanVideoTitle(item.title) : item.title;
              const dur =
                item.duration > 0
                  ? formatMinutes(item.duration)
                  : item.readTimeMinutes
                    ? `${item.readTimeMinutes} min read`
                    : item.durationMinutes
                      ? `${item.durationMinutes} min`
                      : null;

              return (
                <div key={itemId} className={`cart-item cart-item-${itemType}`}>
                  <span className="cart-item-num">{index + 1}</span>
                  <span className="cart-item-icon" title={itemType}>{icon}</span>
                  <div className="cart-item-info">
                    <span className="cart-item-title">{displayTitle}</span>
                    {dur && <span className="cart-item-dur">{dur}</span>}
                  </div>
                  <button
                    className="cart-item-remove"
                    onClick={() => onRemove(itemId)}
                    aria-label={`Remove ${item.title}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <button className="cart-watch-btn" onClick={onWatchPath}>
            ▶ Watch Path
          </button>
        </>
      ) : (
        <div className="cart-empty">
          <span className="cart-empty-icon">📺</span>
          <p>Add videos, docs, and resources to build your learning path</p>
        </div>
      )}
    </div>
  );
}

CartPanel.propTypes = {
  cart: PropTypes.arrayOf(
    PropTypes.shape({
      itemId: PropTypes.string,
      driveId: PropTypes.string,
      type: PropTypes.oneOf(["video", "doc", "youtube"]),
      title: PropTypes.string.isRequired,
      duration: PropTypes.number,
      readTimeMinutes: PropTypes.number,
      durationMinutes: PropTypes.number,
    })
  ).isRequired,
  onRemove: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  onWatchPath: PropTypes.func.isRequired,
};
