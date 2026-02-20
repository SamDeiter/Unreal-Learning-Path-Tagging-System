import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { X, Upload, MessageSquare, AlertCircle, CheckCircle, Bug, Lightbulb } from "lucide-react";
import "./FeedbackModal.css";

import { devLog } from "../../utils/logger";

/**
 * FeedbackModal - A global modal for reporting bugs and sharing feedback.
 * Supports:
 * - Types: Bug, Feature, General
 * - Text description
 * - File attachments (screenshots, logs)
 * - Firestore persistence (authenticated) or localStorage fallback
 */
export default function FeedbackModal({ isOpen, onClose, user }) {
  const [type, setType] = useState("bug"); // bug | feature | general
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [persistedTo, setPersistedTo] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (user && user.uid && user.uid !== "anonymous") {
        // Authenticated — submit to Firestore with file uploads
        const { submitFeedbackToFirestore } = await import("../../services/feedbackService");
        const result = await submitFeedbackToFirestore(
          type,
          description,
          files,
          user.uid,
          user.email || ""
        );
        devLog("📝 Feedback submitted:", result);
        setPersistedTo(result.persisted);
      } else {
        // Unauthenticated — localStorage fallback
        const { recordFormFeedback } = await import("../../services/feedbackService");
        const fileNames = files.map((f) => f.name);
        const result = recordFormFeedback(type, description, fileNames);
        devLog("📝 Feedback saved locally:", result);
        setPersistedTo("local");
      }
    } catch {
      devLog("📝 Feedback submission (offline):", { type, description });
      setPersistedTo("local");
    }

    setSuccess(true);
    setIsSubmitting(false);

    // Auto-close after success
    setTimeout(() => {
      setSuccess(false);
      setDescription("");
      setFiles([]);
      setType("bug");
      setPersistedTo(null);
      onClose();
    }, 2500);
  };

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
        <button className="feedback-close" onClick={onClose}>
          <X size={20} />
        </button>

        {success ? (
          <div className="feedback-success">
            <CheckCircle size={48} className="success-icon" />
            <h3>Thank You!</h3>
            <p>Your feedback helps us improve the learning path.</p>
            {persistedTo === "firestore" && (
              <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "0.5rem" }}>
                ✅ Saved to our database
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="feedback-header">
              <h2>
                <MessageSquare size={24} className="icon-inline" /> Send Feedback
              </h2>
              <p>Found a bug or have an idea? Let us know.</p>
            </div>

            <div className="feedback-type-selector">
              <button
                type="button"
                className={`type-btn ${type === "bug" ? "active" : ""}`}
                onClick={() => setType("bug")}
              >
                <Bug size={16} /> Bug Report
              </button>
              <button
                type="button"
                className={`type-btn ${type === "feature" ? "active" : ""}`}
                onClick={() => setType("feature")}
              >
                <Lightbulb size={16} /> Feature Request
              </button>
              <button
                type="button"
                className={`type-btn ${type === "general" ? "active" : ""}`}
                onClick={() => setType("general")}
              >
                <MessageSquare size={16} /> General
              </button>
            </div>

            <div className="feedback-form-group">
              <label htmlFor="feedback-desc">
                {type === "bug"
                  ? "Describe the issue and steps to reproduce:"
                  : "Tell us about your suggestion:"}
              </label>
              <textarea
                id="feedback-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  type === "bug"
                    ? "e.g., When I click 'Next', the screen goes black..."
                    : "e.g., It would be great if we could..."
                }
                required
                rows={5}
              />
            </div>

            <div className="feedback-form-group">
              <label className="file-upload-label">
                <span className="label-text">Attachments (Screenshots/Logs)</span>
                <button
                  type="button"
                  className="upload-trigger-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} /> Add Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.log,.txt"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>

              {files.length > 0 && (
                <div className="file-list">
                  {files.map((file, i) => (
                    <div key={i} className="file-item">
                      <span className="file-name">{file.name}</span>
                      <button type="button" className="file-remove" onClick={() => removeFile(i)}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="feedback-actions">
              <button type="submit" className="feedback-submit" disabled={isSubmitting}>
                {isSubmitting ? "Uploading..." : "Submit Feedback"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

FeedbackModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  user: PropTypes.shape({
    uid: PropTypes.string,
    email: PropTypes.string,
  }),
};
