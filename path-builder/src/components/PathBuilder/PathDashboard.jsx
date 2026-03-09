/**
 * PathDashboard — Landing page for the Path Builder
 *
 * Shows saved learning paths as cards. Users can:
 * - View existing paths with stats (course count, time, coverage)
 * - Click a path card to open it in the editor
 * - Click "+" to create a new path via the wizard
 * - Toggle to legacy editor mode via settings
 */

import { useState, useCallback } from "react";
import "./PathDashboard.css";

const STORAGE_KEY = "ue5_saved_paths";

function loadSavedPaths() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePaths(paths) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

function PathDashboard({ onEditPath, onCreateNew, onLegacyMode }) {
  const [paths, setPaths] = useState(loadSavedPaths);

  const handleDelete = useCallback((id) => {
    if (!window.confirm("Delete this saved path?")) return;
    setPaths((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePaths(next);
      return next;
    });
  }, []);

  const formatTime = (minutes) => {
    if (!minutes) return "—";
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 1) return "Just now";
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString();
  };

  const gradeColor = (grade) => {
    if (grade === "A" || grade === "B") return "#3fb950";
    if (grade === "C") return "#d29922";
    return "#f85149";
  };

  return (
    <div className="pd-container">
      <div className="pd-header">
        <div className="pd-header-left">
          <h2 className="pd-title">🏗️ Learning Paths</h2>
          <p className="pd-subtitle">Build, manage, and publish your UE5 course paths</p>
        </div>
        <div className="pd-header-right">
          <button
            className="pd-btn pd-btn-ghost"
            onClick={onLegacyMode}
            title="Switch to classic editor"
          >
            ⚡ Classic Editor
          </button>
        </div>
      </div>

      <div className="pd-grid">
        {/* Create New Card */}
        <button className="pd-card pd-card-new" onClick={onCreateNew}>
          <div className="pd-new-icon">+</div>
          <span className="pd-new-label">Create New Path</span>
          <span className="pd-new-hint">Step-by-step wizard</span>
        </button>

        {/* Saved Path Cards */}
        {paths.map((path) => (
          <div key={path.id} className="pd-card pd-card-saved" onClick={() => onEditPath(path)}>
            <div className="pd-card-header">
              <h3 className="pd-card-title">{path.title || "Untitled Path"}</h3>
              <button
                className="pd-card-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(path.id);
                }}
                title="Delete path"
              >
                ×
              </button>
            </div>

            <p className="pd-card-goal">{path.goal || "No goal set"}</p>

            <div className="pd-card-stats">
              <span className="pd-stat">📚 {path.courseCount || 0} courses</span>
              <span className="pd-stat">⏱️ {formatTime(path.totalMinutes)}</span>
              {path.skillLevel && (
                <span className={`pd-level pd-level-${(path.skillLevel || "").toLowerCase()}`}>
                  {path.skillLevel}
                </span>
              )}
            </div>

            <div className="pd-card-footer">
              {path.coverageScore != null && (
                <span className="pd-coverage">{Math.round(path.coverageScore)}% coverage</span>
              )}
              {path.augGrade && (
                <span className="pd-grade" style={{ color: gradeColor(path.augGrade) }}>
                  {path.augGrade}
                </span>
              )}
              <span className="pd-date">{formatDate(path.updatedAt)}</span>
            </div>
          </div>
        ))}

        {paths.length === 0 && (
          <div className="pd-empty">
            <p>
              No saved paths yet. Click <strong>Create New Path</strong> to get started!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Save/update a path in localStorage */
export function savePathToStorage(pathData) {
  const paths = loadSavedPaths();
  const idx = paths.findIndex((p) => p.id === pathData.id);
  if (idx >= 0) {
    paths[idx] = { ...paths[idx], ...pathData, updatedAt: new Date().toISOString() };
  } else {
    paths.push({
      ...pathData,
      id: pathData.id || crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    });
  }
  savePaths(paths);
}

export default PathDashboard;
