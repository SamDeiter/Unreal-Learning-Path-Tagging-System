/**
 * CourseLibrary Component
 *
 * Left panel displaying all available courses.
 * Users can search, filter, and add courses to their learning path.
 *
 * Features:
 * - Search by title, code, or topic
 * - Filter by level (Beginner/Intermediate/Advanced)
 * - Click card to view details
 * - Click + button to add to path
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { usePath } from "../../context/PathContext";
import { filterCourses } from "../../utils/dataProcessing";
import "./CourseLibrary.css";

// Helper to highlight search terms in text
function highlightText(text, query) {
  if (!query || !text) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="search-highlight">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function CourseLibrary({ courses }) {
  const { courses: pathCourses, addCourse } = usePath();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState(null);
  const searchInputRef = useRef(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K - Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Escape - Clear search and filters
      if (e.key === "Escape") {
        if (search || levelFilter) {
          setSearch("");
          setLevelFilter(null);
          searchInputRef.current?.blur();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [search, levelFilter]);

  // Filter courses based on search and filters
  const filteredCourses = useMemo(() => {
    return filterCourses(courses, {
      search,
      level: levelFilter,
    });
  }, [courses, search, levelFilter]);

  // Check if course is already in path
  const isInPath = (courseCode) => {
    return pathCourses.some((c) => c.code === courseCode);
  };

  // Handle add to path
  const handleAddCourse = (e, course) => {
    e.stopPropagation();
    if (!isInPath(course.code)) {
      addCourse(course);
    }
  };

  return (
    <div className="course-library">
      {/* Search & Filters */}
      <div className="library-header">
        <div className="search-container">
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search courses... (Ctrl+K)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")} title="Clear search">
              ×
            </button>
          )}
        </div>

        <div className="level-filters">
          {["Beginner", "Intermediate", "Advanced"].map((level) => (
            <button
              key={level}
              className={`level-btn ${levelFilter === level ? "active" : ""} ${level.toLowerCase()}`}
              onClick={() => setLevelFilter(levelFilter === level ? null : level)}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Course Count with Search Context */}
      <div className="library-info">
        {search || levelFilter ? (
          <span>
            <strong>{filteredCourses.length}</strong> result
            {filteredCourses.length !== 1 ? "s" : ""}
            {search && (
              <>
                {" "}
                for "<em>{search}</em>"
              </>
            )}
            {levelFilter && <> • {levelFilter}</>}
          </span>
        ) : (
          <span>{filteredCourses.length} courses</span>
        )}
        {(search || levelFilter) && (
          <button
            className="clear-filters"
            onClick={() => {
              setSearch("");
              setLevelFilter(null);
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Course List */}
      <div className="course-list">
        {filteredCourses.map((course, index) => (
          <div
            key={`${course.code}-${index}`}
            className={`course-card ${isInPath(course.code) ? "in-path" : ""}`}
            title={`${course.title}\n\nCode: ${course.code}\nLevel: ${course.tags?.level || "N/A"}\nDuration: ${course.duration ? `${course.duration.toFixed(1)} hours` : "Unknown"}\nVideos: ${course.video_count || 0}\nVersions: ${course.versions?.join(", ") || "N/A"}`}
          >
            <div className="card-content">
              <div className="card-header">
                <span className="course-code">{course.code}</span>
                {course.has_ai_tags && (
                  <span className="ai-badge" title="AI-enriched">
                    ✨
                  </span>
                )}
              </div>
              <h3 className="course-title">{highlightText(course.title, search)}</h3>
              <div className="card-tags">
                {course.tags?.level && (
                  <span className={`tag tag-level ${course.tags.level.toLowerCase()}`}>
                    {course.tags.level}
                  </span>
                )}
                {course.tags?.topic && <span className="tag tag-topic">{course.tags.topic}</span>}
              </div>
              <div className="card-meta">
                {course.duration && (
                  <span title={`${course.duration.toFixed(1)} hours of content`}>
                    ⏱️ {course.duration.toFixed(1)}h
                  </span>
                )}
                <span
                  title={`${course.video_count || 0} video${(course.video_count || 0) === 1 ? "" : "s"}`}
                >
                  🎬 {course.video_count || 0}
                </span>
                <span
                  title={`${course.versions?.length || 0} UE version${(course.versions?.length || 0) === 1 ? "" : "s"}`}
                >
                  📦 {course.versions?.length || 0} ver
                </span>
              </div>
            </div>

            <button
              className={`add-btn ${isInPath(course.code) ? "added" : ""}`}
              onClick={(e) => handleAddCourse(e, course)}
              disabled={isInPath(course.code)}
              title={isInPath(course.code) ? "In path" : "Add to path"}
            >
              {isInPath(course.code) ? "✓" : "+"}
            </button>
          </div>
        ))}

        {filteredCourses.length === 0 && (
          <div className="no-results">No courses match your search.</div>
        )}
      </div>
    </div>
  );
}

export default CourseLibrary;
