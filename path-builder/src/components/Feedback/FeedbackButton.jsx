import { useState } from "react";
import PropTypes from "prop-types";
import { MessageSquare } from "lucide-react";
import FeedbackModal from "./FeedbackModal";
import "./FeedbackButton.css";

/**
 * FeedbackButton - A floating action button that opens the FeedbackModal.
 * Positioning can be customized via CSS.
 */
export default function FeedbackButton({ user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  /* global __BUILD_HASH__, __BUILD_TIME__ */
  const hash = typeof __BUILD_HASH__ !== "undefined" ? __BUILD_HASH__ : "dev";
  const buildTime = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "";
  const shortDate = buildTime ? new Date(buildTime).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  return (
    <>
      <div className="feedback-bar">
        <span className="build-info" title={`Build: ${hash} — ${buildTime}`}>
          v{hash}{shortDate ? ` · ${shortDate}` : ""}
        </span>
        <button
          className="feedback-fab"
          onClick={() => setIsModalOpen(true)}
          aria-label="Send Feedback"
          title="Report a bug or suggestion"
        >
          <MessageSquare size={20} />
          <span className="feedback-label">Feedback</span>
        </button>
      </div>

      <FeedbackModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} user={user} />
    </>
  );
}

FeedbackButton.propTypes = {
  user: PropTypes.shape({
    uid: PropTypes.string,
    email: PropTypes.string,
  }),
};
