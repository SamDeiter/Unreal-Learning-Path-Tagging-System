/**
 * ChatInput — sticky-bottom composer for the scrolling chat thread.
 *
 * Props:
 *   onSend:    (text: string) => void
 *   disabled?: boolean
 *   placeholder?: string
 *   minLength?: number   default 10
 */
import { useState, useCallback } from "react";
import PropTypes from "prop-types";
import { MODIFIER_KEY } from "../../utils/osUtils";

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Describe your UE5 problem…",
  minLength = 10,
}) {
  const [text, setText] = useState("");

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length < minLength || disabled) return;
    onSend(trimmed);
    setText("");
  }, [text, disabled, onSend, minLength]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submit();
      }
    },
    [submit]
  );

  return (
    <div className="chat-input-dock">
      <div className="chat-input-inner">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          aria-label="Chat input"
        />
        <button
          type="button"
          className="chat-input-send"
          onClick={submit}
          disabled={disabled || text.trim().length < minLength}
        >
          Send
        </button>
      </div>
      <div className="chat-input-hint">
        Press <kbd>{MODIFIER_KEY}</kbd>+<kbd>Enter</kbd> to send
      </div>
    </div>
  );
}

ChatInput.propTypes = {
  onSend: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  minLength: PropTypes.number,
};
