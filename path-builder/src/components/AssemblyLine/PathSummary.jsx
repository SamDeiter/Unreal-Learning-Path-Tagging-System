/**
 * PathSummary Component
 *
 * Bottom bar displaying path statistics and export options.
 *
 * Features:
 * - Live stats: course count, estimated time, level progression
 * - Export dropdown: SCORM, xAPI, JSON
 * - Clear path button
 */
import { usePath } from "../../context/PathContext";
import "./PathSummary.css";

import { devLog } from "../../utils/logger";

function PathSummary() {
  const { courses, pathStats, clearPath } = usePath();

  const handleExport = (format) => {
    // TODO: Implement export in Phase 4
    devLog(`Exporting as ${format}...`, courses);
    alert(`Export to ${format} coming soon!`);
  };

  if (courses.length === 0) {
    return null;
  }

  return (
    <div className="path-summary">
      <div className="summary-stats">
        <div className="stat">
          <span className="stat-icon">📚</span>
          <span className="stat-value">{pathStats.courseCount}</span>
          <span className="stat-label">Courses</span>
        </div>

        <div className="stat">
          <span className="stat-icon">⏱️</span>
          <span className="stat-value">~{pathStats.estimatedHours}h</span>
          <span className="stat-label">Est. Time</span>
        </div>

        {pathStats.levelRange && (
          <div className="stat">
            <span className="stat-icon">📊</span>
            <span className="stat-value">{pathStats.levelRange}</span>
            <span className="stat-label">Level Progression</span>
          </div>
        )}

        {pathStats.topics.length > 0 && (
          <div className="stat topics">
            <span className="stat-icon">🏷️</span>
            <span className="stat-value">
              {pathStats.topics.slice(0, 3).join(", ")}
              {pathStats.topics.length > 3 && ` +${pathStats.topics.length - 3}`}
            </span>
            <span className="stat-label">Topics</span>
          </div>
        )}
      </div>

      <div className="summary-actions">
        <button className="btn btn-secondary" onClick={clearPath}>
          Clear Path
        </button>

        <div className="export-group">
          <button className="btn btn-primary" onClick={() => handleExport("json")}>
            Export
          </button>
          <div className="export-dropdown">
            <button
              className="btn btn-primary dropdown-toggle"
              onClick={(e) => {
                e.currentTarget.parentElement.classList.toggle("open");
              }}
            >
              ▼
            </button>
            <div className="dropdown-menu">
              <button onClick={() => handleExport("json")}>JSON</button>
              <button onClick={() => handleExport("scorm")}>SCORM 1.2</button>
              <button onClick={() => handleExport("xapi")}>xAPI (Tin Can)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PathSummary;
