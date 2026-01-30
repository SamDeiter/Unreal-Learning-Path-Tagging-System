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
import { optimizePathOrder } from "../../utils/generationEngine";
import "./AssemblyLine.css";

function AssemblyLine() {
  const { courses, removeCourse, reorderCourses, updateCourseMeta } = usePath();

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

  const handleOptimize = () => {
    const optimized = optimizePathOrder(courses);
    reorderCourses(optimized);
  };

  // Get node classes
  const getNodeClasses = (course) => {
    const classes = ["path-node"];
    if (course.tags?.level) classes.push(course.tags.level.toLowerCase());
    if (course.role) classes.push(course.role.toLowerCase().replace(/\s+/g, "-")); // e.g. "next-step"
    return classes.join(" ");
  };

  return (
    <div className="assembly-line">
      <div className="assembly-header">
        <h2 className="assembly-title">Your Learning Path</h2>
        {courses.length > 1 && (
          <button className="btn btn-secondary btn-sm" onClick={handleOptimize}>
            ⚡ Optimize Order
          </button>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>Start Building Your Path</h3>
          <p>Add courses from the library to create your learning sequence.</p>
          <p className="hint">Courses will appear here as a visual timeline.</p>
        </div>
      ) : (
        <div className="path-container">
          <div className="assembly-tiers">
            {["Beginner", "Intermediate", "Advanced"].map((level) => {
              // Filter courses for this tier
              const tierCourses = courses.filter((c) => (c.tags?.level || "Beginner") === level);

              if (tierCourses.length === 0) return null;

              return (
                <div key={level} className="tier-row">
                  <div className="tier-header">
                    <span className="tier-title">{level}</span>
                    <span className="tier-count">{tierCourses.length}</span>
                  </div>
                  <div className="tier-track">
                    {tierCourses.map((course, idx) => {
                      // Find actual global index for data operations
                      const globalIndex = courses.findIndex((c) => c.code === course.code);

                      return (
                        <div key={course.code} className="path-item">
                          {/* Connector Arrow (except for first item in tier) */}
                          {idx > 0 && (
                            <div className="connector">
                              <div className="connector-line"></div>
                              <div className="connector-arrow">▶</div>
                            </div>
                          )}

                          {/* Course Node */}
                          <div
                            className={getNodeClasses(course)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, globalIndex)}
                            onDragEnd={handleDragEnd}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, globalIndex)}
                          >
                            <div className="node-header">
                              <div className="node-number">{globalIndex + 1}</div>
                              <button
                                className="node-remove-mini"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCourse(course.code);
                                }}
                              >
                                ×
                              </button>
                            </div>

                            {/* Node Content */}
                            <div className="node-content">
                              <span className="node-code">{course.code}</span>
                              <span className="node-title" title={course.title}>
                                {course.title}
                              </span>
                            </div>

                            {/* Node Controls */}
                            <div
                              className="node-controls"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <select
                                className="node-select role"
                                value={course.role || "Core"}
                                onChange={(e) => {
                                  const newRole = e.target.value;
                                  let newWeight = "Medium";
                                  if (newRole === "Prerequisite") newWeight = "High";
                                  if (newRole === "Supplemental") newWeight = "Low";
                                  if (newRole === "Next Step") newWeight = "Low";

                                  updateCourseMeta(course.code, {
                                    role: newRole,
                                    weight: newWeight,
                                  });
                                }}
                                title="Role"
                              >
                                <option value="Core">Core</option>
                                <option value="Prerequisite">Pre-req</option>
                                <option value="Supplemental">Supp</option>
                                <option value="Next Step">Next Step</option>
                              </select>
                              <select
                                className="node-select weight"
                                value={course.weight || "Medium"}
                                onChange={(e) =>
                                  updateCourseMeta(course.code, { weight: e.target.value })
                                }
                                title="Weight"
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Med</option>
                                <option value="High">High</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Catch-all for courses with no level or weird level if any */}
            {courses.some(
              (c) => !["Beginner", "Intermediate", "Advanced"].includes(c.tags?.level || "Beginner")
            ) && (
              <div className="tier-row">
                <div className="tier-header">
                  <span className="tier-title">Other</span>
                </div>
                <div className="tier-track">
                  {courses
                    .filter(
                      (c) =>
                        !["Beginner", "Intermediate", "Advanced"].includes(
                          c.tags?.level || "Beginner"
                        )
                    )
                    .map((course, idx) => {
                      const globalIndex = courses.findIndex((c) => c.code === course.code);
                      return (
                        <div key={course.code} className="path-item">
                          {idx > 0 && (
                            <div className="connector">
                              <div className="connector-line"></div>
                              <div>▶</div>
                            </div>
                          )}
                          <div
                            className={getNodeClasses(course)}
                            draggable
                            onDragStart={(e) => handleDragStart(e, globalIndex)}
                            onDragEnd={handleDragEnd}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, globalIndex)}
                          >
                            <div className="node-header">
                              <div className="node-number">{globalIndex + 1}</div>
                              <button
                                className="node-remove-mini"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCourse(course.code);
                                }}
                              >
                                ×
                              </button>
                            </div>
                            <div className="node-content">
                              <span className="node-code">{course.code}</span>
                              <span className="node-title" title={course.title}>
                                {course.title}
                              </span>
                            </div>
                            <div
                              className="node-controls"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <select
                                className="node-select role"
                                value={course.role || "Core"}
                                onChange={(e) => {
                                  const newRole = e.target.value;
                                  let newWeight = "Medium";
                                  if (newRole === "Prerequisite") newWeight = "High";
                                  if (newRole === "Supplemental") newWeight = "Low";
                                  if (newRole === "Next Step") newWeight = "Low";

                                  updateCourseMeta(course.code, {
                                    role: newRole,
                                    weight: newWeight,
                                  });
                                }}
                              >
                                <option value="Core">Core</option>
                                <option value="Prerequisite">Pre-req</option>
                                <option value="Supplemental">Supp</option>
                                <option value="Next Step">Next Step</option>
                              </select>
                              <select
                                className="node-select weight"
                                value={course.weight || "Medium"}
                                onChange={(e) =>
                                  updateCourseMeta(course.code, { weight: e.target.value })
                                }
                                title="Weight"
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Med</option>
                                <option value="High">High</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Add More Indicator (Global Footer) */}
          <div className="path-footer-add">
            <div className="connector-vertical">
              <div className="connector-line-v"></div>
            </div>
            <div className="path-item add-more">
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
