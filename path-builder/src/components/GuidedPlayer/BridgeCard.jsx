/**
 * BridgeCard — Transition card between courses in the learning path.
 */
import PropTypes from "prop-types";

export default function BridgeCard({ bridgeContent, onContinue }) {
  return (
    <div className={`bridge-card ${bridgeContent.type}`}>
      <div className="bridge-icon">
        {bridgeContent.type === "transition" ? "🔄" : "➡️"}
      </div>
      <h3>{bridgeContent.text}</h3>
      {bridgeContent.subtext && <p className="subtext">{bridgeContent.subtext}</p>}
      <button className="continue-btn" onClick={onContinue}>
        Continue →
      </button>
    </div>
  );
}

BridgeCard.propTypes = {
  bridgeContent: PropTypes.shape({
    type: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    subtext: PropTypes.string,
  }).isRequired,
  onContinue: PropTypes.func.isRequired,
};
