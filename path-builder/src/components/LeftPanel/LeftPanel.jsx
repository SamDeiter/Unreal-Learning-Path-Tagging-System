import { useState } from "react";
import CourseLibrary from "../CourseLibrary/CourseLibrary";
import SkillCurriculum from "./SkillCurriculum";
import "./LeftPanel.css";

function LeftPanel({ courses, preSelectedSkill, onSkillUsed }) {
  const [mode, setMode] = useState("skill"); // 'skill' | 'browse' - skill-first!

  return (
    <div className="left-panel">
      <div className="panel-tabs">
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
          <SkillCurriculum courses={courses} preSelectedSkill={preSelectedSkill} onSkillUsed={onSkillUsed} />
        ) : (
          <CourseLibrary courses={courses} />
        )}
      </div>
    </div>
  );
}

export default LeftPanel;
