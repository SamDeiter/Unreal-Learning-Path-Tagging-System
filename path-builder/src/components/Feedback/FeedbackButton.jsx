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

  return (
    <>
      <button
        className="feedback-fab"
        onClick={() => setIsModalOpen(true)}
        aria-label="Send Feedback"
        title="Report a bug or suggestion"
      >
        <MessageSquare size={20} />
        <span className="feedback-label">Feedback</span>
      </button>

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
