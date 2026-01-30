import { useState } from "react";
import CourseLibrary from "../CourseLibrary/CourseLibrary";
import TagPathBuilder from "./TagPathBuilder";
import "./LeftPanel.css";

function LeftPanel({ courses }) {
  const [mode, setMode] = useState("browse"); // 'browse' | 'tags'

  return (
    <div className="left-panel">
      <div className="panel-tabs">
        <button
          className={`panel-tab ${mode === "browse" ? "active" : ""}`}
          onClick={() => setMode("browse")}
        >
          Browse Courses
        </button>
        <button
          className={`panel-tab ${mode === "tags" ? "active" : ""}`}
          onClick={() => setMode("tags")}
        >
          Build by Tags
        </button>
      </div>

      <div className="panel-content">
        {mode === "browse" ? (
          <CourseLibrary courses={courses} />
        ) : (
          <TagPathBuilder courses={courses} />
        )}
      </div>
    </div>
  );
}

export default LeftPanel;
