/**
 * SpeakButton — reusable "Read aloud" control backed by useSpeech.
 *
 * Phase-3 UDL/accessibility affordance (TTS). Shows an icon that reflects
 * idle / speaking / paused state for the bound id. Clicking:
 *   - idle:     starts speaking `text`
 *   - speaking (this id): pauses
 *   - paused (this id):   resumes
 *   - other id active:    cancels the other and starts this one
 *
 * Renders nothing when speechSynthesis is unsupported.
 */
import PropTypes from "prop-types";
import { Volume2, Pause, Play } from "lucide-react";
import useSpeech from "../../hooks/useSpeech";

export default function SpeakButton({ text, id, label = "Read aloud", className = "" }) {
  const { speak, pause, resume, state, currentId, supported } = useSpeech();

  if (!supported) return null;
  if (!text || !text.trim()) return null;

  const isMine = currentId === id;
  const isSpeaking = isMine && state === "speaking";
  const isPaused = isMine && state === "paused";

  let Icon = Volume2;
  let title = label;
  if (isSpeaking) {
    Icon = Pause;
    title = "Pause reading";
  } else if (isPaused) {
    Icon = Play;
    title = "Resume reading";
  }

  const onClick = (e) => {
    e.stopPropagation();
    if (isSpeaking) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      speak(text, id);
    }
  };

  return (
    <button
      type="button"
      className={`speak-btn ${className}`.trim()}
      onClick={onClick}
      aria-label={title}
      aria-pressed={isSpeaking || isPaused}
      title={title}
    >
      <Icon size={12} aria-hidden="true" style={{ marginRight: "4px", display: "inline" }} />
      <span className="speak-btn__label">{label}</span>
    </button>
  );
}

SpeakButton.propTypes = {
  text: PropTypes.string,
  id: PropTypes.string.isRequired,
  label: PropTypes.string,
  className: PropTypes.string,
};
