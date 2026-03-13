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
import { useMemo, useState } from "react";
import { usePath } from "../../context/PathContext";
import { optimizePathOrder } from "../../utils/generationEngine";
import { useAugmentationData } from "../../hooks/useAugmentationData";
import { classifySegment, getBloomBadge } from "../../services/bloomClassifier";
import { getDisplayName } from "../../services/topicNameService";
import {
  estimateCognitiveLoad,
  getLoadSummary,
  interleaveCourses,
} from "../../services/cognitiveLoadEngine";
import "./AssemblyLine.css";
import SmartEmptyState from "./SmartEmptyState";
import ModuleCard from "./ModuleCard";

// Determine content type from course properties
function getContentType(course) {
  const code = course.code || "";
  const source = course.source || course.segment?.source || "";
  const type = course.type || course.segment?.type || "";

  // Explicit AI-generated
  if (source === "ai_generated" || code.startsWith("ai-"))
    return { emoji: "🤖", label: "AI", cls: "ct-ai" };
  // Transcript clip (matched segment from corpus)
  if (code.startsWith("bespoke-")) return { emoji: "🎯", label: "Clip", cls: "ct-clip" };
  // Check actual video data — prioritize data over code prefix
  if (
    (course.videos?.length || 0) > 0 ||
    course.video_count > 0 ||
    type === "video" ||
    source === "video" ||
    course.has_scorm
  )
    return { emoji: "🎬", label: "Video", cls: "ct-video" };
  // Doc prefix — only if no video signals found
  if (code.startsWith("doc_") || code.startsWith("doc-") || source === "epic_docs")
    return { emoji: "📄", label: "Doc", cls: "ct-doc" };
  return { emoji: "📄", label: "Course", cls: "ct-default" };
}



// Collapsible tag legend explaining Bloom levels and content types
function TagLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="tag-legend" style={{ padding: "0 16px 8px", fontSize: "0.72rem" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none", border: "none", color: "var(--text-muted, #8b949e)",
          cursor: "pointer", fontSize: "0.72rem", padding: "2px 0",
        }}
      >
        {open ? "▾" : "▸"} What do these tags mean?
      </button>
      {open && (
        <div style={{ margin: "4px 0 0 8px", lineHeight: 1.6, color: "var(--text-secondary, #8b949e)" }}>
          <div><strong>Bloom Levels:</strong></div>
          <div>📖 <strong>Remember</strong> — Recall facts and basic concepts</div>
          <div>💡 <strong>Understand</strong> — Explain ideas or concepts</div>
          <div>⚙️ <strong>Apply</strong> — Use information in new situations</div>
          <div>🔍 <strong>Analyze</strong> — Draw connections among ideas</div>
          <div>⚖️ <strong>Evaluate</strong> — Justify a stance or decision</div>
          <div>🎨 <strong>Create</strong> — Produce new or original work</div>
          <div style={{ marginTop: 4 }}><strong>Content Types:</strong></div>
          <div>🎬 Video · 📄 Doc · 🎞️ Bespoke · 🤖 AI · 📦 SCORM</div>
          <div style={{ marginTop: 4, fontStyle: "italic" }}>💡 Focus on Apply and Create steps for deeper mastery.</div>
        </div>
      )}
    </div>
  );
}

function AssemblyLine() {
  const {
    courses,
    modules,
    ungroupedCourses,
    removeCourse,
    reorderCourses,
    updateCourseMeta,
    clearPath,
    learningIntent,
    pathStats,
    workflowStage,
    addModule,
    moveCourseToModule,
  } = usePath();

  // Dynamic title: use the learning intent query, fallback to generic
  const pathTitle = learningIntent?.primaryGoal || "Your Learning Path";
  const { getCourseSummary, getVideoKeys } = useAugmentationData();

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
    // Step 1: Legacy sort by role/weight (always produces visible change)
    const baseSorted = optimizePathOrder(courses);
    // Step 2: Layer on cognitive load interleaving
    let finalOrder;
    try {
      const interleaved = interleaveCourses(baseSorted);
      finalOrder = interleaved.map(({ cognitiveLoad: _cl, ...rest }) => rest);
    } catch {
      finalOrder = baseSorted;
    }
    // Step 3: Pin "Introduction to Unreal Engine/Editor" to position 0
    const introPattern = /\bintroduction\s+to\s+unreal\s*(engine|editor)?\b/i;
    const introIdx = finalOrder.findIndex((c) => introPattern.test(c.title || ""));
    if (introIdx > 0) {
      const [intro] = finalOrder.splice(introIdx, 1);
      finalOrder.unshift(intro);
    }
    reorderCourses(finalOrder);
  };

  // Compute cognitive load summary for entire path
  const loadSummary = useMemo(() => {
    if (courses.length === 0) return null;
    return getLoadSummary(courses);
  }, [courses]);

  // Render Bloom's taxonomy badge for a course
  const renderBloomBadge = (course) => {
    const bloom = classifySegment(
      course.title || "",
      course.gemini_enriched?.one_sentence_summary || ""
    );
    const badge = getBloomBadge(bloom.level);
    return (
      <span
        className="bloom-badge"
        style={{ color: badge.color, borderColor: badge.color }}
        title={`Bloom's Taxonomy: ${badge.label} (${Math.round(bloom.confidence * 100)}%)`}
      >
        {badge.emoji} {badge.label}
      </span>
    );
  };

  // Render cognitive load dot
  const renderLoadDot = (course) => {
    const { load } = estimateCognitiveLoad(course);
    const color = load < 3 ? "#3fb950" : load < 5 ? "#d29922" : "#f85149";
    const label = load < 3 ? "Low" : load < 5 ? "Medium" : "High";
    return (
      <span
        className="load-dot"
        style={{ backgroundColor: color }}
        title={`Cognitive Load: ${load}/10 (${label})`}
      />
    );
  };

  // Get node classes — includes content-type for color-coding
  const getNodeClasses = (course) => {
    const classes = ["path-node"];
    if (course.tags?.level) classes.push(course.tags.level.toLowerCase());
    if (course.role) classes.push(course.role.toLowerCase().replace(/\s+/g, "-")); // e.g. "next-step"
    const ct = getContentType(course);
    classes.push(ct.cls); // e.g. "ct-video", "ct-doc", "ct-bespoke"
    if (course.verified === "verified") classes.push("node-verified");
    if (course.verified === "rejected") classes.push("node-rejected");
    return classes.join(" ");
  };

  // Render augmentation badge + action for a course
  const renderAugBadge = (course) => {
    const aug = getCourseSummary(course.code);
    if (!aug) return null;
    const videoKeys = getVideoKeys(course.code);
    const firstKey = videoKeys[0] || "";
    const base = import.meta.env.BASE_URL;
    const needsAug = aug.avgGrade === "D" || aug.avgGrade === "F";
    return (
      <>
        <div className="aug-row">
          <span
            className={`aug-badge aug-${aug.avgGrade} aug-clickable`}
            title={`${aug.avgScore}/55 \u00b7 ${aug.verdict.replace(/_/g, " ")} \u00b7 ${aug.videoCount} videos \u2014 Click to view evaluation`}
            onClick={(e) => {
              e.stopPropagation();
              if (firstKey)
                window.open(`${base}augmentation_evaluator.html?video=${firstKey}`, "_blank");
            }}
          >
            {aug.avgGrade}
          </span>
          <span className="aug-score">{aug.avgScore}/55</span>
          <div className="aug-bar">
            <div className="aug-bar-proc" style={{ width: `${aug.avgProcedural}%` }} />
            <div className="aug-bar-conc" style={{ width: `${aug.avgConceptual}%` }} />
          </div>
        </div>
        {needsAug && firstKey && (
          <button
            className="aug-action"
            title="Open the augmented guided view for this course"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`${base}augmentation_viewer.html?video=${firstKey}`, "_blank");
            }}
          >
            ⚡ View Augmented Guide
          </button>
        )}
      </>
    );
  };

  return (
    <div className="assembly-line">
      <div className="assembly-header">
        <div className="assembly-title-group">
          <h2 className="assembly-title">{pathTitle}</h2>
          {courses.length > 0 && (
            <span className="path-summary">
              {courses.length} course{courses.length !== 1 ? "s" : ""} •{" ~"}
              {pathStats.estimatedHours}h
              {pathStats.estimatedHours >= 40 && (
                <span className="duration-warn duration-critical" title="Path exceeds 40 hours — consider splitting into multiple paths">
                  🚨 Very Long
                </span>
              )}
              {pathStats.estimatedHours >= 20 && pathStats.estimatedHours < 40 && (
                <span className="duration-warn duration-amber" title="Path exceeds 20 hours — learners may struggle with this volume">
                  ⚠️ Long
                </span>
              )}
              {" "}•{" "}
              {courses.reduce((sum, c) => sum + (c.video_count || c.videos?.length || 0), 0)} videos
              {loadSummary && (
                <span
                  className="load-summary"
                  title={`Cognitive Load — Low: ${loadSummary.distribution.low}, Medium: ${loadSummary.distribution.medium}, High: ${loadSummary.distribution.high}`}
                >
                  {" "}
                  • 🧠 Load: {loadSummary.avg}/10
                  <span
                    className={`load-indicator ${loadSummary.avg < 3 ? "low" : loadSummary.avg < 5 ? "medium" : "high"}`}
                  />
                </span>
              )}
            </span>
          )}
        </div>
        <div className="assembly-actions">
          {courses.length > 1 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleOptimize}
              title="Smart reorder: prerequisite graph → cognitive load interleaving"
            >
              ⚡ Smart Order
            </button>
          )}
          {courses.length > 0 && (
            <button
              className="btn btn-danger btn-sm"
              title="Remove all courses from your learning path"
              onClick={() => clearPath()}
            >
              🗑️ Clear All
            </button>
          )}
        </div>
      </div>

      {/* Tag Legend */}
      {courses.length > 0 && (
        <TagLegend />
      )}

      {courses.length === 0 ? (
        <SmartEmptyState
          goal={learningIntent?.primaryGoal}
          skillLevel={learningIntent?.skillLevel}
          onBrowseLibrary={() => {
            window.dispatchEvent(new CustomEvent("focus-left-panel", { detail: { mode: "browse" } }));
          }}
          onBuildBySkill={(skill) => {
            window.dispatchEvent(new CustomEvent("focus-left-panel", { detail: { mode: "skill", skill } }));
          }}
        />
      ) : (
        <div className="path-container">
          {/* ── Milestone Modules ───────────────────────────────────────── */}
          {modules.length > 0 && workflowStage === "build" && (
            <div className="assembly-modules">
              <div className="assembly-modules__header">
                <span className="assembly-modules__label">Milestones</span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => addModule()}
                  title="Add a new milestone group"
                >
                  + Add Milestone
                </button>
              </div>
              {modules.map((mod, idx) => {
                // Render course mini-cards for this module
                const moduleCourses = mod.courseIds
                  .map((code) => courses.find((c) => c.code === code))
                  .filter(Boolean);
                const courseCards = moduleCourses.map((course) => (
                  <div
                    key={course.code}
                    className="module-course-chip"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", course.code)}
                    title={course.title}
                  >
                    <span className="module-course-chip__title">{getDisplayName(course)}</span>
                    <button
                      className="module-course-chip__remove"
                      onClick={() => moveCourseToModule(course.code, null)}
                      title="Remove from milestone"
                    >
                      ×
                    </button>
                  </div>
                ));
                return (
                  <ModuleCard
                    key={mod.id}
                    module={mod}
                    courseCards={courseCards}
                    index={idx}
                    onDropCourse={(courseCode, moduleId) => moveCourseToModule(courseCode, moduleId)}
                  />
                );
              })}
              {/* Ungrouped courses */}
              {ungroupedCourses.length > 0 && (
                <div className="assembly-modules__ungrouped">
                  <span className="assembly-modules__ungrouped-label">
                    Ungrouped ({ungroupedCourses.length})
                  </span>
                  <div className="assembly-modules__ungrouped-chips">
                    {ungroupedCourses.map((course) => (
                      <div
                        key={course.code}
                        className="module-course-chip module-course-chip--ungrouped"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", course.code)}
                        title={`Drag to a milestone: ${course.title}`}
                      >
                        <span className="module-course-chip__title">{getDisplayName(course)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tier-based course rendering ───────────────────────────── */}
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
                              {(() => {
                                const ct = getContentType(course);
                                return (
                                  <span className={`node-type-label ${ct.cls}`}>
                                    {ct.emoji} {ct.label}
                                  </span>
                                );
                              })()}
                              {workflowStage !== "export" && (
                                <button
                                  className="node-remove-mini"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeCourse(course.code);
                                  }}
                                >
                                  ×
                                </button>
                              )}
                            </div>

                            {/* Node Content */}
                            <div className="node-content">
                              <span className="node-title" title={course.title}>
                                {getDisplayName(course)}
                              </span>
                            </div>

                            {/* Hover-reveal details */}
                            <div className="node-details">
                              {renderAugBadge(course)}
                            </div>

                            {/* Node Controls — always visible during Build, hidden during Export */}
                            {workflowStage !== "export" && (
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
                                  title="Priority/Importance"
                                >
                                  <option value="Low">Low</option>
                                  <option value="Medium">Med</option>
                                  <option value="High">High</option>
                                </select>
                              </div>
                            )}

                            {/* Bloom badge — review & export stages */}
                            {(workflowStage === "review" || workflowStage === "export") && (
                              <div className="node-review-badges">
                                {renderBloomBadge(course)}
                                {renderLoadDot(course)}
                              </div>
                            )}

                            {/* Verification buttons — review stage only */}
                            {workflowStage === "review" && (
                              <div className="node-verify-actions" onClick={(e) => e.stopPropagation()}>
                                {course.verified === "verified" ? (
                                  <button
                                    className="verify-label verified"
                                    onClick={() => updateCourseMeta(course.code, { verified: "unverified" })}
                                    title="Click to undo approval"
                                  >
                                    ✅ Approved
                                  </button>
                                ) : course.verified === "rejected" ? (
                                  <button
                                    className="verify-label rejected"
                                    onClick={() => updateCourseMeta(course.code, { verified: "unverified" })}
                                    title="Click to undo"
                                  >
                                    🚩 Flagged — Undo
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      className="verify-btn accept"
                                      onClick={() => updateCourseMeta(course.code, { verified: "verified" })}
                                    >
                                      👍 Approve
                                    </button>
                                    <button
                                      className="verify-btn reject"
                                      onClick={() => updateCourseMeta(course.code, { verified: "rejected" })}
                                    >
                                      🚩 Flag
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
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
                            {/* Augmentation Quality Badge */}
                            {renderAugBadge(course)}
                            <div className="node-content">
                              <div className="node-title-row">
                                <span className="node-code">{course.code}</span>
                                {renderLoadDot(course)}
                              </div>
                              <span className="node-title" title={course.title}>
                                {getDisplayName(course)}
                              </span>
                              {renderBloomBadge(course)}
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
                                title="Priority/Importance: High = Must-learn critical content, Medium = Should-learn standard content, Low = Nice-to-know optional content"
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
            <div
              className="path-item add-more"
              style={{ cursor: "pointer" }}
              onClick={() => {
                const searchInput = document.querySelector(".sc-search-input");
                if (searchInput) {
                  searchInput.focus();
                  searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
              title="Click to search for more courses"
            >
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
