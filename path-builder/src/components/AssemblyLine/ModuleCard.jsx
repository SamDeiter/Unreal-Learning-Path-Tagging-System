/**
 * ModuleCard — Collapsible milestone card wrapping a group of courses.
 *
 * Features:
 * - Editable title + outcome text
 * - Collapse/expand animation
 * - Course count badge
 * - Remove module button
 * - Drop zone for adding courses
 */
import { useState, useRef } from "react";
import { usePath } from "../../context/PathContext";
import "./ModuleCard.css";

export default function ModuleCard({
  module,
  courseCards,
  index: _index,
  onDropCourse,
}) {
  const { renameModule, removeModule } = usePath();
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState(false);
  const titleRef = useRef(null);
  const outcomeRef = useRef(null);

  // Drag-over state for drop zone
  const [dragOver, setDragOver] = useState(false);

  const handleTitleBlur = () => {
    setEditingTitle(false);
    const newTitle = titleRef.current?.innerText?.trim();
    if (newTitle && newTitle !== module.title) {
      renameModule(module.id, newTitle, undefined);
    }
  };

  const handleOutcomeBlur = () => {
    setEditingOutcome(false);
    const newOutcome = outcomeRef.current?.innerText?.trim();
    if (newOutcome !== module.outcome) {
      renameModule(module.id, undefined, newOutcome);
    }
  };

  const handleKeyDown = (e, blurFn) => {
    if (e.key === "Enter") {
      e.preventDefault();
      blurFn();
    }
  };

  // Drop handler for DnD
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const courseCode = e.dataTransfer.getData("text/plain");
    if (courseCode && onDropCourse) {
      onDropCourse(courseCode, module.id);
    }
  };

  return (
    <div
      className={`module-card ${collapsed ? "module-card--collapsed" : ""} ${dragOver ? "module-card--drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="module-card__header">
        <button
          className="module-card__collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand milestone" : "Collapse milestone"}
        >
          <span className={`module-card__chevron ${collapsed ? "module-card__chevron--collapsed" : ""}`}>
            ▾
          </span>
        </button>

        <div className="module-card__title-area">
          {editingTitle ? (
            <span
              ref={titleRef}
              className="module-card__title module-card__title--editing"
              contentEditable
              suppressContentEditableWarning
              onBlur={handleTitleBlur}
              onKeyDown={(e) => handleKeyDown(e, handleTitleBlur)}
              tabIndex={0}
            >
              {module.title}
            </span>
          ) : (
            <span
              className="module-card__title"
              onClick={() => setEditingTitle(true)}
              title="Click to rename"
            >
              {module.title}
            </span>
          )}

          <span className="module-card__badge">
            {module.courseIds.length} course{module.courseIds.length !== 1 ? "s" : ""}
          </span>
        </div>

        <button
          className="module-card__remove-btn"
          onClick={() => removeModule(module.id)}
          title="Remove milestone (courses become ungrouped)"
        >
          ×
        </button>
      </div>

      {/* Outcome subtitle */}
      {!collapsed && (
        <div className="module-card__outcome">
          {editingOutcome ? (
            <span
              ref={outcomeRef}
              className="module-card__outcome-text module-card__outcome-text--editing"
              contentEditable
              suppressContentEditableWarning
              onBlur={handleOutcomeBlur}
              onKeyDown={(e) => handleKeyDown(e, handleOutcomeBlur)}
              tabIndex={0}
            >
              {module.outcome || ""}
            </span>
          ) : (
            <span
              className="module-card__outcome-text"
              onClick={() => setEditingOutcome(true)}
              title="Click to add a learning outcome"
            >
              {module.outcome || "Click to add a learning outcome..."}
            </span>
          )}
        </div>
      )}

      {/* Course cards container */}
      {!collapsed && (
        <div className="module-card__courses">
          {courseCards}
          {module.courseIds.length === 0 && (
            <div className="module-card__empty">
              Drag courses here to add them to this milestone
            </div>
          )}
        </div>
      )}
    </div>
  );
}
