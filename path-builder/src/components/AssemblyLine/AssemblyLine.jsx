/**
 * AssemblyLine Component
 *
 * Main visual area showing the learning path as a horizontal sequence.
 * Courses are displayed as numbered nodes connected by arrows (A → B → C).
 *
 * Features:
 * - Visual sequence of courses with connecting arrows
 * - Drag to reorder courses within the line
 * - Click node to view details or remove
 * - Drop zone at end to add new courses
 */
import { usePath } from "../../context/PathContext";
import "./AssemblyLine.css";

function AssemblyLine() {
  const { courses, removeCourse, reorderCourses } = usePath();

  // Handle drag start
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData("text/plain", index.toString());
    e.currentTarget.classList.add("dragging");
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove("dragging");
  };

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  // Handle drag leave
  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove("drag-over");
  };

  // Handle drop
  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");

    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (sourceIndex === targetIndex) return;

    // Reorder the courses
    const newCourses = [...courses];
    const [moved] = newCourses.splice(sourceIndex, 1);
    newCourses.splice(targetIndex, 0, moved);
    reorderCourses(newCourses);
  };

  // Get level color class
  const getLevelClass = (level) => {
    if (!level) return "";
    return level.toLowerCase();
  };

  return (
    <div className="assembly-line">
      <h2 className="assembly-title">Your Learning Path</h2>

      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>Start Building Your Path</h3>
          <p>Add courses from the library to create your learning sequence.</p>
          <p className="hint">Courses will appear here as a visual timeline.</p>
        </div>
      ) : (
        <div className="path-container">
          <div className="path-line">
            {courses.map((course, index) => (
              <div key={course.code} className="path-item">
                {/* Connector Arrow (except for first item) */}
                {index > 0 && (
                  <div className="connector">
                    <div className="connector-line"></div>
                    <div className="connector-arrow">▶</div>
                  </div>
                )}

                {/* Course Node */}
                <div
                  className={`path-node ${getLevelClass(course.tags?.level)}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <div className="node-number">{index + 1}</div>
                  <div className="node-content">
                    <span className="node-code">{course.code}</span>
                    <span className="node-title">{course.title}</span>
                    <span className={`node-level ${getLevelClass(course.tags?.level)}`}>
                      {course.tags?.level || "Unknown"}
                    </span>
                  </div>
                  <button
                    className="node-remove"
                    onClick={() => removeCourse(course.code)}
                    title="Remove from path"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            {/* Add More Indicator */}
            <div className="path-item add-more">
              <div className="connector">
                <div className="connector-line dashed"></div>
              </div>
              <div className="add-node">
                <span>+</span>
                <span className="add-text">Add More</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AssemblyLine;
