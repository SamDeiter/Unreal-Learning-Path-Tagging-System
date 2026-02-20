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
import { matchCoursesToGoal } from "../../utils/courseMatchingUtils";
import { Search, Sparkles, Clock, Clapperboard, Layers, Plus, X, Check } from "lucide-react";
import { getRelevanceBadge } from "../../services/ContentGapService";
import { detectPersona } from "../../services/PersonaService";
import "./CourseLibrary.css";

// ... (highlightText helper remains same)

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
  const { courses: pathCourses, addCourse, learningIntent } = usePath();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState(null);
  const searchInputRef = useRef(null);

  // Get suggested courses based on learning goal
  const suggestedCourses = useMemo(() => {
    const goal = learningIntent?.primaryGoal;
    if (!goal) return [];
    return matchCoursesToGoal(goal, courses, 8);
  }, [learningIntent, courses]);

  // Detect active persona from learning goal
  const activePersonaId = useMemo(() => {
    const goal = learningIntent?.primaryGoal;
    if (!goal) return null;
    const result = detectPersona(goal);
    return result?.id || null;
  }, [learningIntent]);

  // Filter out already-in-path courses from suggestions
  const availableSuggestions = useMemo(() => {
    return suggestedCourses.filter((c) => !pathCourses.some((p) => p.code === c.code));
  }, [suggestedCourses, pathCourses]);

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

  // Handle add all suggested courses
  const handleAddAllSuggested = () => {
    availableSuggestions.forEach((course) => {
      addCourse(course);
    });
  };

  return (
    <div className="course-library">
      {/* Suggested Courses Section - appears when goal is set */}
      {learningIntent?.primaryGoal && availableSuggestions.length > 0 && (
        <div className="suggested-section">
          <div className="suggested-header">
            <span className="suggested-title">
              <Sparkles size={16} className="icon-inline" /> Suggested for "
              {learningIntent.primaryGoal}"
            </span>
            <button
              className="add-all-btn"
              onClick={handleAddAllSuggested}
              title="Add all suggested courses to your path"
            >
              <Plus size={14} /> Add All ({availableSuggestions.length})
            </button>
          </div>
          <div className="suggested-list">
            {availableSuggestions.slice(0, 5).map((course, index) => {
              const badge = activePersonaId ? getRelevanceBadge(course, activePersonaId) : null;
              return (
                <div
                  key={`suggested-${course.code}-${index}`}
                  className="suggested-card"
                  onClick={(e) => handleAddCourse(e, course)}
                  title={`Match score: ${course.matchScore}\n${course.title}`}
                >
                  <span className="suggested-code">{course.code}</span>
                  <span className="suggested-name">{course.title}</span>
                  {badge?.label && (
                    <span className={`tag tag-persona tag-persona-${badge.type}`}>
                      {badge.label}
                    </span>
                  )}
                  <span className="suggested-add">
                    <Plus size={14} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Goal Hint */}
      {!learningIntent?.primaryGoal && (
        <div className="goal-hint">
          <Sparkles size={16} className="icon-inline" /> Enter a <strong>Primary Goal</strong> above
          to get personalized course suggestions
        </div>
      )}

      {/* Search & Filters */}
      <div className="library-header">
        <div className="search-container">
          <Search size={16} className="search-icon" />
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
              <X size={14} />
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
                {course.gemini_enriched && (
                  <span className="ai-badge" title="AI-enriched">
                    <Sparkles size={12} />
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
                {activePersonaId &&
                  (() => {
                    const badge = getRelevanceBadge(course, activePersonaId);
                    if (badge.label) {
                      return (
                        <span
                          className={`tag tag-persona tag-persona-${badge.type}`}
                          title={`Persona relevance: ${badge.score > 0 ? "+" : ""}${badge.score}`}
                        >
                          {badge.label}
                        </span>
                      );
                    }
                    return null;
                  })()}
              </div>
              <div className="card-meta">
                {course.duration && (
                  <span
                    title={`${course.duration.toFixed(1)} hours of content`}
                    className="meta-item"
                  >
                    <Clock size={12} /> {course.duration.toFixed(1)}h
                  </span>
                )}
                <span
                  title={`${course.video_count || 0} video${(course.video_count || 0) === 1 ? "" : "s"}`}
                  className="meta-item"
                >
                  <Clapperboard size={12} /> {course.video_count || 0}
                </span>
                <span
                  title={`${course.versions?.length || 0} UE version${(course.versions?.length || 0) === 1 ? "" : "s"}`}
                  className="meta-item"
                >
                  <Layers size={12} /> {course.versions?.length || 0}
                </span>
              </div>
            </div>

            <button
              className={`add-btn ${isInPath(course.code) ? "added" : ""}`}
              onClick={(e) => handleAddCourse(e, course)}
              disabled={isInPath(course.code)}
              title={isInPath(course.code) ? "In path" : "Add to path"}
            >
              {isInPath(course.code) ? <Check size={16} /> : <Plus size={16} />}
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
