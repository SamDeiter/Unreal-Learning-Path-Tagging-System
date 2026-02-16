import { useState, useMemo } from "react";
import { useTagData } from "../../context/TagDataContext";
import "./TagTrends.css";

/**
 * Tag Distribution with Course Drill-Down
 * Click any tag to see the actual courses tagged with it
 */
function TagTrends() {
  const { courses } = useTagData();
  const [selectedTag, setSelectedTag] = useState(null);

  // Calculate tag counts from actual course data
  const tagData = useMemo(() => {
    const tagCounts = new Map();
    const tagCoursesMap = new Map();

    courses.forEach((course) => {
      const courseId = course.code || course.id || course.title;

      // Collect all tags from different sources
      const allTags = [
        ...(course.gemini_system_tags || []),
        ...(course.ai_tags || []),
        ...(course.transcript_tags || []),
        ...Object.keys(course.tags || {}),
      ];

      // Normalize and count
      allTags.forEach((tag) => {
        const normalized = tag.toLowerCase().trim();
        if (normalized && normalized.length > 2) {
          tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
          if (!tagCoursesMap.has(normalized)) tagCoursesMap.set(normalized, []);
          const arr = tagCoursesMap.get(normalized);
          if (!arr.find((c) => c.id === courseId)) {
            arr.push({
              id: courseId,
              title: course.title,
              level: String(course.level || course.difficulty || course.tags?.level || "Beginner"),
              duration: course.duration,
            });
          }
        }
      });
    });

    // Sort by count and take top 12
    return [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({
        name,
        count,
        courses: tagCoursesMap.get(name) || [],
      }));
  }, [courses]);

  const colors = [
    "#58a6ff",
    "#a371f7",
    "#3fb950",
    "#f0883e",
    "#f778ba",
    "#db6d28",
    "#768390",
    "#54aeff",
    "#7ee787",
    "#ff9bce",
    "#d2a8ff",
    "#79c0ff",
  ];

  const maxValue = useMemo(() => {
    return Math.max(...tagData.map((t) => t.count), 1);
  }, [tagData]);

  const handleBarClick = (tagName) => {
    setSelectedTag(selectedTag === tagName ? null : tagName);
  };

  const selectedTagData = tagData.find((t) => t.name === selectedTag);

  return (
    <div className="tag-trends">
      <div className="trends-header">
        <h4>
          📊 Tag Distribution
          <span className="info-tooltip">
            ⓘ<span className="tooltip-content">Click any tag to see courses tagged with it</span>
          </span>
        </h4>
        <span className="trends-subtitle">From {courses.length} courses • Click to drill down</span>
      </div>

      <div className="trends-bar-chart">
        {tagData.map((tag, i) => (
          <div
            key={tag.name}
            className={`bar-row ${selectedTag === tag.name ? "selected" : ""}`}
            onClick={() => handleBarClick(tag.name)}
          >
            <span className="bar-label" title={tag.name}>
              {tag.name}
            </span>
            <div className="bar-container">
              <div
                className="bar-fill"
                style={{
                  width: `${(tag.count / maxValue) * 100}%`,
                  backgroundColor: colors[i % colors.length],
                }}
              />
            </div>
            <span className="bar-value">{tag.count}</span>
          </div>
        ))}
      </div>

      {/* Course drill-down panel */}
      {selectedTagData && (
        <div className="tag-courses-panel">
          <div className="panel-header">
            <h5>📚 Courses tagged "{selectedTag}"</h5>
            <button className="close-btn" onClick={() => setSelectedTag(null)}>
              ×
            </button>
          </div>
          <div className="courses-list">
            {selectedTagData.courses.slice(0, 8).map((course) => (
              <div key={course.id} className="course-item">
                <span className="course-title">{course.title}</span>
                <span className={`course-level ${String(course.level || "").toLowerCase()}`}>
                  {course.level}
                </span>
              </div>
            ))}
            {selectedTagData.courses.length > 8 && (
              <div className="more-courses">+{selectedTagData.courses.length - 8} more courses</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TagTrends;
