import { useState, useEffect } from "react";
import CourseLibrary from "../CourseLibrary/CourseLibrary";
import SkillCurriculum from "./SkillCurriculum";
import "./LeftPanel.css";

function LeftPanel({ courses, preSelectedSkill, onSkillUsed, onBackToDashboard }) {
  const [mode, setMode] = useState("skill"); // 'skill' | 'browse' - skill-first!

  // Listen for SmartEmptyState actions that request focus on a specific tab
  useEffect(() => {
    const handler = (e) => {
      const { mode: requestedMode, skill } = e.detail || {};
      if (requestedMode === "browse") {
        setMode("browse");
      } else if (requestedMode === "skill") {
        setMode("skill");
        // If a skill topic was passed, trigger skill selection via onSkillUsed
        if (skill && onSkillUsed) {
          setTimeout(() => onSkillUsed(null), 50);
        }
      }
    };
    window.addEventListener("focus-left-panel", handler);
    return () => window.removeEventListener("focus-left-panel", handler);
  }, [onSkillUsed]);

  return (
    <div className="left-panel">
      <div className="panel-tabs">
        {onBackToDashboard && (
          <button
            className="panel-tab panel-tab-back"
            onClick={onBackToDashboard}
            title="Back to Learning Paths list"
          >
            ← Paths
          </button>
        )}
        <button
          className={`panel-tab ${mode === "skill" ? "active" : ""}`}
          onClick={() => setMode("skill")}
        >
          🎯 Build by Skill
        </button>
        <button
          className={`panel-tab ${mode === "browse" ? "active" : ""}`}
          onClick={() => setMode("browse")}
        >
          📚 Browse All
        </button>
      </div>

      <div className="panel-content">
        {mode === "skill" ? (
          <SkillCurriculum
            courses={courses}
            preSelectedSkill={preSelectedSkill}
            onSkillUsed={onSkillUsed}
          />
        ) : (
          <CourseLibrary courses={courses} />
        )}
      </div>
    </div>
  );
}

export default LeftPanel;
