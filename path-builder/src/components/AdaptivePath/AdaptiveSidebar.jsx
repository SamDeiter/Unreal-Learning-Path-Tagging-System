/**
 * AdaptiveSidebar — Phase navigation + voice selector for adaptive path
 */
import { cleanVideoTitle } from "../../utils/cleanVideoTitle";

export default function AdaptiveSidebar({
  phases,
  activePhaseKey,
  pathData,
  expandedStep,
  setExpandedStep,
  voiceName,
  setVoiceName,
  knowledgeProfile,
  hasSavedProfile,
  clearProfile,
  setShowLevelPicker,
  setPendingCleanedQuery,
  query,
}) {
  return (
    <aside className="epic-sidebar">
      <div className="sidebar-title">
        🎯 Adaptive Path
        <span
          style={{
            display: "block",
            fontSize: "0.65rem",
            color: "var(--accent-orange)",
            marginTop: "4px",
          }}
        >
          {knowledgeProfile?.level} level
        </span>
        {hasSavedProfile && (
          <button
            onClick={() => {
              clearProfile();
              setShowLevelPicker(true);
              setPendingCleanedQuery(query);
            }}
            style={{
              display: "block",
              marginTop: "6px",
              background: "transparent",
              border: "none",
              color: "#64748b",
              fontSize: "0.6rem",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            ⚙️ Change Experience Level
          </button>
        )}
      </div>
      <nav className="phase-nav">
        {phases.map((phase) => (
          <div key={phase.key} className="phase-group">
            <button
              className={`phase-nav-item ${activePhaseKey === phase.key ? "active" : ""}`}
              onClick={() => {
                if (phase.key === "quiz") {
                  setExpandedStep(-2);
                } else if (phase.key === "reading") {
                  setExpandedStep(-3);
                } else {
                  const idx = phase.steps[0]?.globalIndex ?? 0;
                  setExpandedStep(idx);
                }
              }}
            >
              {phase.label}
            </button>
            {/* Substep list — only for real content phases */}
            {phase.key !== "quiz" &&
              phase.key !== "reading" &&
              phase.steps.length > 0 && (
                <ul className="substep-list">
                  {phase.steps.map((substep, i) => {
                    const step = pathData.path[substep.globalIndex];
                    let rawTitle =
                      step?.title ||
                      cleanVideoTitle(step?.segment?.title || step?.segment?.videoTitle) ||
                      (step?.summary
                        ? step.summary.split(".")[0].substring(0, 50)
                        : null) ||
                      `Part ${i + 1}`;
                    return (
                      <li key={substep.globalIndex}>
                        <button
                          className={`substep-item ${(expandedStep ?? 0) === substep.globalIndex ? "active" : ""}`}
                          onClick={() => setExpandedStep(substep.globalIndex)}
                          title={rawTitle}
                        >
                          {i + 1}. {rawTitle}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>
        ))}
      </nav>
      <div className="voice-selector">
        <label className="voice-label" htmlFor="voice-select">
          🎤 Narrator Voice
        </label>
        <select
          id="voice-select"
          className="voice-dropdown"
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
        >
          <option value="Kore">Kore (Female)</option>
          <option value="Aoede">Aoede (Female)</option>
          <option value="Leda">Leda (Female)</option>
          <option value="Puck">Puck (Male)</option>
          <option value="Charon">Charon (Male)</option>
          <option value="Fenrir">Fenrir (Male)</option>
          <option value="Orus">Orus (Male)</option>
          <option value="Zephyr">Zephyr (Neutral)</option>
        </select>
      </div>
    </aside>
  );
}
