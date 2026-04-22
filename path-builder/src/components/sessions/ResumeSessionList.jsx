/**
 * ResumeSessionList — Collapsible panel showing the user's prior sessions.
 *
 * Props:
 *   onResume:         (session) => void   // parent hydrates chat
 *   currentSessionId: string | undefined  // highlighted in the list
 *   className:        string (optional)
 */
import { useState } from "react";
import PropTypes from "prop-types";
import useSessions from "../../hooks/useSessions";
import "./ResumeSessionList.css";

const MODE_LABELS = {
  "problem-first": "Fix",
  "goal-build": "Goal",
  "explore-first": "Explore",
};

function relativeTime(ms) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

function preview(text, max = 80) {
  const t = (text || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function ResumeSessionList({ onResume, currentSessionId, className = "" }) {
  const { sessions, loading, error } = useSessions();
  const [collapsed, setCollapsed] = useState(false);

  const header = (
    <button
      type="button"
      className="resume-sessions-header"
      onClick={() => setCollapsed((c) => !c)}
      aria-expanded={!collapsed}
    >
      <span className="resume-sessions-title">Recent sessions</span>
      <span className="resume-sessions-count">{sessions.length}</span>
      <span className="resume-sessions-chevron">{collapsed ? "▸" : "▾"}</span>
    </button>
  );

  return (
    <aside className={`resume-sessions ${className}`.trim()}>
      {header}
      {!collapsed && (
        <div className="resume-sessions-body">
          {loading && <div className="resume-sessions-empty">Loading…</div>}
          {!loading && error && (
            <div className="resume-sessions-empty">Couldn&apos;t load sessions.</div>
          )}
          {!loading && !error && sessions.length === 0 && (
            <div className="resume-sessions-empty">
              <p>No prior sessions</p>
              <span>Your saved chats will appear here once you ask your first question.</span>
            </div>
          )}
          {!loading && !error && sessions.length > 0 && (
            <ul className="resume-sessions-list">
              {sessions.map((s) => {
                const isCurrent = s.id === currentSessionId;
                return (
                  <li
                    key={s.id}
                    className={`resume-session-item ${isCurrent ? "current" : ""}`}
                  >
                    <div className="resume-session-meta">
                      <span className={`resume-session-mode mode-${s.mode}`}>
                        {MODE_LABELS[s.mode] || s.mode}
                      </span>
                      <span className="resume-session-time">{relativeTime(s.updatedAt)}</span>
                    </div>
                    <div className="resume-session-query" title={s.query}>
                      {preview(s.query) || <em>(no query)</em>}
                    </div>
                    <button
                      type="button"
                      className="resume-session-btn"
                      onClick={() => onResume?.(s)}
                      disabled={isCurrent}
                    >
                      {isCurrent ? "Current" : "Resume"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}

ResumeSessionList.propTypes = {
  onResume: PropTypes.func.isRequired,
  currentSessionId: PropTypes.string,
  className: PropTypes.string,
};
