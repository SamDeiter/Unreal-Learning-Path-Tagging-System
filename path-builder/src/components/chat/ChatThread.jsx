/**
 * ChatThread — scrolling list of chat bubbles, auto-scrolls to bottom on
 * new messages. Presentational; all state lives in the parent hook.
 *
 * Props:
 *   messages:          Message[]  — flat ordered list
 *   onClarifyAnswer?:  (choice: string) => void
 *   onClarifySkip?:    () => void
 *   renderRich?:       (message) => ReactNode   — custom render for
 *                      kind 'diagnosis' / 'path' rich bubbles
 *   emptyState?:       ReactNode                — shown when messages is empty
 */
import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import MessageBubble from "./MessageBubble";
import "./ChatThread.css";

export default function ChatThread({
  messages,
  onClarifyAnswer,
  onClarifySkip,
  renderRich,
  emptyState,
  sessionId,
}) {
  const bottomRef = useRef(null);

  const lastKind = messages[messages.length - 1]?.kind;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastKind]);

  if (!messages.length && emptyState) {
    return <div className="chat-thread">{emptyState}</div>;
  }

  return (
    <div className="chat-thread" role="log" aria-live="polite">
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          onClarifyAnswer={onClarifyAnswer}
          onClarifySkip={onClarifySkip}
          renderRich={renderRich}
          sessionId={sessionId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

ChatThread.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClarifyAnswer: PropTypes.func,
  onClarifySkip: PropTypes.func,
  renderRich: PropTypes.func,
  emptyState: PropTypes.node,
  sessionId: PropTypes.string,
};
