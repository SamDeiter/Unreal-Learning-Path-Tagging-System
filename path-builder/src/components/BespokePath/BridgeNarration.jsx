/**
 * BridgeNarration — Transitional text between path steps.
 * Shows a connecting arrow and AI-generated or template narration.
 */

export default function BridgeNarration({ bridge, fromCategory, toCategory }) {
  const narration = bridge?.narration || "Continue to the next step.";
  const isTransition = fromCategory !== toCategory;

  return (
    <div className={`bridge-narration ${isTransition ? "category-transition" : ""}`}>
      <div className="bridge-connector">
        <div className="bridge-line" />
        <div className="bridge-arrow" />
      </div>
      <div className="bridge-text">
        <p>{narration}</p>
      </div>
    </div>
  );
}
