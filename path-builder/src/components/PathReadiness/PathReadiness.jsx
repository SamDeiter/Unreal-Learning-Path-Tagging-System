import { useMemo, useState } from "react";
import { useTagData } from "../../context/TagDataContext";
import "./PathReadiness.css";

/**
 * Path Readiness Dashboard - helps instructors decide which learning paths to build
 * Shows: Complete Progressions, Incomplete Progressions, Content Gap Matrix
 */
function PathReadiness() {
  const { courses } = useTagData();
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'ready' | 'incomplete' | 'gap'

  // Analyze topic progressions
  const topicAnalysis = useMemo(() => {
    const analysis = {};
    const levels = ["Beginner", "Intermediate", "Advanced"];

    courses.forEach((course) => {
      const topic = course.topic || course.tags?.topic;
      if (!topic || topic === "Other") return;

      const level = course.tags?.level || "Intermediate";
      const duration = course.duration_minutes || course.total_duration_minutes || 0;

      if (!analysis[topic]) {
        analysis[topic] = {
          topic,
          levels: { Beginner: [], Intermediate: [], Advanced: [] },
          totalCourses: 0,
          totalDuration: 0,
        };
      }

      if (analysis[topic].levels[level]) {
        analysis[topic].levels[level].push({
          code: course.code,
          title: course.title || course.name,
          duration,
          hasAI: course.has_ai_tags,
        });
      }
      analysis[topic].totalCourses++;
      analysis[topic].totalDuration += duration;
    });

    // Classify each topic
    return Object.values(analysis).map((t) => {
      const hasB = t.levels.Beginner.length > 0;
      const hasI = t.levels.Intermediate.length > 0;
      const hasA = t.levels.Advanced.length > 0;
      const levelCount = [hasB, hasI, hasA].filter(Boolean).length;

      let status, statusLabel, missing;
      if (levelCount === 3) {
        status = "ready";
        statusLabel = "✅ Path Ready";
        missing = [];
      } else if (levelCount === 2) {
        status = "incomplete";
        statusLabel = "🟡 Almost Ready";
        missing = [];
        if (!hasB) missing.push("Beginner");
        if (!hasI) missing.push("Intermediate");
        if (!hasA) missing.push("Advanced");
      } else if (levelCount === 1) {
        status = "incomplete";
        statusLabel = "🟠 Needs Content";
        missing = [];
        if (!hasB) missing.push("Beginner");
        if (!hasI) missing.push("Intermediate");
        if (!hasA) missing.push("Advanced");
      } else {
        status = "gap";
        statusLabel = "❌ Major Gap";
        missing = levels;
      }

      return {
        ...t,
        status,
        statusLabel,
        missing,
        levelCount,
      };
    }).sort((a, b) => b.levelCount - a.levelCount || b.totalCourses - a.totalCourses);
  }, [courses]);

  // Filter topics based on status
  const filteredTopics = useMemo(() => {
    if (filterStatus === "all") return topicAnalysis;
    return topicAnalysis.filter((t) => t.status === filterStatus);
  }, [topicAnalysis, filterStatus]);

  // Summary stats
  const stats = useMemo(() => {
    const ready = topicAnalysis.filter((t) => t.status === "ready").length;
    const incomplete = topicAnalysis.filter((t) => t.status === "incomplete").length;
    const gap = topicAnalysis.filter((t) => t.status === "gap").length;
    return { ready, incomplete, gap, total: topicAnalysis.length };
  }, [topicAnalysis]);

  // Format duration
  const formatDuration = (mins) => {
    if (!mins) return "—";
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="path-readiness">
      {/* Header */}
      <div className="pr-header">
        <h2>📚 Path Readiness Dashboard</h2>
        <p>Identify which topics are ready to package as learning paths for your LMS</p>
      </div>

      {/* Summary Cards */}
      <div className="pr-stats">
        <div
          className={`pr-stat-card ready ${filterStatus === "ready" ? "active" : ""}`}
          onClick={() => setFilterStatus(filterStatus === "ready" ? "all" : "ready")}
        >
          <div className="pr-stat-value">{stats.ready}</div>
          <div className="pr-stat-label">Path Ready</div>
          <div className="pr-stat-hint">All 3 levels covered</div>
        </div>
        <div
          className={`pr-stat-card incomplete ${filterStatus === "incomplete" ? "active" : ""}`}
          onClick={() => setFilterStatus(filterStatus === "incomplete" ? "all" : "incomplete")}
        >
          <div className="pr-stat-value">{stats.incomplete}</div>
          <div className="pr-stat-label">Almost Ready</div>
          <div className="pr-stat-hint">Missing 1-2 levels</div>
        </div>
        <div
          className={`pr-stat-card gap ${filterStatus === "gap" ? "active" : ""}`}
          onClick={() => setFilterStatus(filterStatus === "gap" ? "all" : "gap")}
        >
          <div className="pr-stat-value">{stats.gap}</div>
          <div className="pr-stat-label">Major Gaps</div>
          <div className="pr-stat-hint">No courses yet</div>
        </div>
        <div
          className={`pr-stat-card total ${filterStatus === "all" ? "active" : ""}`}
          onClick={() => setFilterStatus("all")}
        >
          <div className="pr-stat-value">{stats.total}</div>
          <div className="pr-stat-label">Total Topics</div>
          <div className="pr-stat-hint">Click to show all</div>
        </div>
      </div>

      {/* Content Gap Matrix */}
      <div className="pr-section">
        <h3>📊 Content Gap Matrix</h3>
        <p className="pr-section-desc">
          Topics × Difficulty Levels — Green = Ready, Yellow = Partial, Red = Gap
        </p>
        <div className="gap-matrix">
          <table>
            <thead>
              <tr>
                <th className="topic-col">Topic</th>
                <th className="level-col">Beginner</th>
                <th className="level-col">Intermediate</th>
                <th className="level-col">Advanced</th>
                <th className="status-col">Status</th>
                <th className="duration-col">Duration</th>
              </tr>
            </thead>
            <tbody>
              {filteredTopics.map((topic) => (
                <tr
                  key={topic.topic}
                  className={`matrix-row ${selectedTopic === topic.topic ? "selected" : ""}`}
                  onClick={() => setSelectedTopic(selectedTopic === topic.topic ? null : topic.topic)}
                >
                  <td className="topic-cell">
                    <strong>{topic.topic}</strong>
                    <span className="course-count">{topic.totalCourses} courses</span>
                  </td>
                  {["Beginner", "Intermediate", "Advanced"].map((level) => {
                    const count = topic.levels[level].length;
                    const cellClass = count >= 2 ? "cell-ready" : count === 1 ? "cell-partial" : "cell-gap";
                    return (
                      <td key={level} className={`level-cell ${cellClass}`}>
                        {count > 0 ? (
                          <span className="level-count">{count}</span>
                        ) : (
                          <span className="level-missing">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="status-cell">
                    <span className={`status-badge ${topic.status}`}>{topic.statusLabel}</span>
                  </td>
                  <td className="duration-cell">{formatDuration(topic.totalDuration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Topic Detail Panel */}
      {selectedTopic && (
        <div className="pr-section detail-panel">
          <h3>
            📋 {selectedTopic} — Course Breakdown
            <button className="close-btn" onClick={() => setSelectedTopic(null)}>×</button>
          </h3>
          {(() => {
            const topic = topicAnalysis.find((t) => t.topic === selectedTopic);
            if (!topic) return null;
            return (
              <div className="level-breakdown">
                {["Beginner", "Intermediate", "Advanced"].map((level) => (
                  <div key={level} className="level-group">
                    <h4 className={`level-header ${level.toLowerCase()}`}>
                      {level}
                      <span className="level-badge">{topic.levels[level].length} courses</span>
                    </h4>
                    {topic.levels[level].length > 0 ? (
                      <ul className="course-list">
                        {topic.levels[level].map((course) => (
                          <li key={course.code}>
                            <span className="course-code">{course.code}</span>
                            <span className="course-title">{course.title}</span>
                            {course.duration > 0 && (
                              <span className="course-duration">{formatDuration(course.duration)}</span>
                            )}
                            {course.hasAI && <span className="ai-badge">AI</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="no-courses">
                        ⚠️ No {level.toLowerCase()} courses — consider adding content here
                      </div>
                    )}
                  </div>
                ))}
                {topic.missing.length > 0 && (
                  <div className="recommendation-box">
                    <strong>💡 Recommendation:</strong> Add {topic.missing.join(" and ")} level content
                    to complete this learning path.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="pr-legend">
        <span className="legend-item">
          <span className="legend-dot ready"></span> 2+ courses (Ready)
        </span>
        <span className="legend-item">
          <span className="legend-dot partial"></span> 1 course (Partial)
        </span>
        <span className="legend-item">
          <span className="legend-dot gap"></span> 0 courses (Gap)
        </span>
      </div>
    </div>
  );
}

export default PathReadiness;
