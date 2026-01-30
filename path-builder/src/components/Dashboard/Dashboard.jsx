import { useMemo, useState } from "react";
import { useTagData } from "../../context/TagDataContext";
import "./Dashboard.css";

/**
 * Coverage Dashboard - displays stats cards, charts, tag cloud,
 * recommendations, and courses table for the course library
 */
function Dashboard() {
  const { courses, tags, edges } = useTagData();
  const [sortField, setSortField] = useState("code");
  const [sortDirection, setSortDirection] = useState("asc");

  // Calculate stats
  const stats = useMemo(() => {
    const totalCourses = courses.length;
    const totalVideos = courses.reduce((sum, c) => sum + (c.video_count || 0), 0);
    const coursesWithVideos = courses.filter((c) => c.video_count > 0).length;
    const aiEnriched = courses.filter((c) => c.has_ai_tags).length;

    return { totalCourses, totalVideos, coursesWithVideos, aiEnriched };
  }, [courses]);

  // Calculate topic distribution (from courses) - excludes "Other" from chart
  const topicDistribution = useMemo(() => {
    if (!courses || courses.length === 0) return [];

    // Group courses by topic (check both course.topic and course.tags?.topic)
    const topics = {};
    courses.forEach((course) => {
      const topic = course.topic || course.tags?.topic || "Other";
      // Skip "Other" - fragments like Outro/WrapUp don't need to pollute analytics
      if (topic === "Other") return;
      topics[topic] = (topics[topic] || 0) + 1;
    });

    // Convert to array and sort
    return Object.entries(topics)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [courses]);

  // Calculate level distribution
  const levelDistribution = useMemo(() => {
    const levels = { Beginner: 0, Intermediate: 0, Advanced: 0 };
    courses.forEach((course) => {
      const level = course.tags?.level || "Intermediate";
      if (levels[level] !== undefined) {
        levels[level]++;
      }
    });
    return levels;
  }, [courses]);

  // Get top 100 tags for Tag Cloud
  const tagCloud = useMemo(() => {
    if (!tags || tags.length === 0) return [];
    return [...tags].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 100);
  }, [tags]);

  // Calculate industry distribution for recommendations
  const industryDistribution = useMemo(() => {
    const industries = {};
    courses.forEach((course) => {
      const industry = course.tags?.industry || "General";
      industries[industry] = (industries[industry] || 0) + 1;
    });
    return industries;
  }, [courses]);

  // Calculate coverage recommendations
  const recommendations = useMemo(() => {
    const recs = [];

    // Find topics with low coverage (less than 3 courses) - skip "Other"
    const topicCounts = {};
    courses.forEach((course) => {
      const topic = course.topic || course.tags?.topic || "Other";
      if (topic === "Other") return; // Skip fragments
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    Object.entries(topicCounts)
      .filter(([, count]) => count < 3)
      .forEach(([topic, count]) => {
        recs.push({
          type: "gap",
          title: `${topic}: Low Coverage`,
          description: `Only ${count} course${count === 1 ? "" : "s"} cover this topic. Consider adding more content.`,
          badge: `${count} course${count === 1 ? "" : "s"}`,
        });
      });

    // Find missing level progressions - skip "Other"
    const topicLevels = {};
    courses.forEach((course) => {
      const topic = course.topic || course.tags?.topic || "Other";
      if (topic === "Other") return; // Skip fragments
      const level = course.tags?.level || "Intermediate";
      if (!topicLevels[topic]) topicLevels[topic] = new Set();
      topicLevels[topic].add(level);
    });

    Object.entries(topicLevels).forEach(([topic, levels]) => {
      if (!levels.has("Advanced") && levels.size >= 1) {
        recs.push({
          type: "opportunity",
          title: `No Advanced ${topic} Course`,
          description: `Add an advanced-level course for ${topic} to complete the learning path.`,
          badge: "Missing level",
        });
      }
    });

    return recs.slice(0, 6); // Limit to 6 recommendations
  }, [courses]);

  // Sort courses for table
  const sortedCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      let aVal, bVal;

      // Handle nested tag fields
      if (["level", "topic", "industry"].includes(sortField)) {
        aVal = a.tags?.[sortField] || "";
        bVal = b.tags?.[sortField] || "";
      } else if (sortField === "video_count") {
        aVal = a.video_count || 0;
        bVal = b.video_count || 0;
      } else {
        aVal = a[sortField] || "";
        bVal = b[sortField] || "";
      }

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  }, [courses, sortField, sortDirection]);

  // Calculate max for chart scaling
  const maxTopicCount =
    topicDistribution.length > 0 ? Math.max(...topicDistribution.map((t) => t.count)) : 1;

  const totalLevelCount = Object.values(levelDistribution).reduce((a, b) => a + b, 0);

  // Handle sort click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Get tag color based on category or count
  const getTagColor = (tag, index) => {
    const colors = [
      "#f0a020", // Orange/Gold
      "#a371f7", // Purple
      "#3fb950", // Green
      "#58a6ff", // Blue
      "#f85149", // Red
      "#79c0ff", // Light blue
      "#d2a8ff", // Light purple
      "#7ee787", // Light green
    ];

    // Use category-based coloring for consistency
    if (tag.category_path) {
      const category = tag.category_path.split("/")[0];
      const hash = category.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return colors[hash % colors.length];
    }

    return colors[index % colors.length];
  };

  // Get level badge class
  const getLevelClass = (level) => {
    switch (level?.toLowerCase()) {
      case "beginner":
        return "level-badge beginner";
      case "advanced":
        return "level-badge advanced";
      default:
        return "level-badge intermediate";
    }
  };

  return (
    <div className="dashboard">
      {/* Stats Cards */}
      <div className="stats-cards">
        <div className="stat-card primary">
          <div className="stat-number">{stats.totalCourses}</div>
          <div className="stat-label">TOTAL COURSES</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.totalVideos}</div>
          <div className="stat-label">VIDEO FILES</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.coursesWithVideos}</div>
          <div className="stat-label">COURSES WITH VIDEOS</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-number">{stats.aiEnriched}</div>
          <div className="stat-label">AI-ENRICHED</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Topic Distribution Bar Chart */}
        <div className="chart-card">
          <h3>
            <span className="chart-indicator"></span> Content by Topic
          </h3>
          <div className="bar-chart">
            {topicDistribution.map((topic) => (
              <div key={topic.name} className="bar-row">
                <span className="bar-label">{topic.name}</span>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{ width: `${(topic.count / maxTopicCount) * 100}%` }}
                  ></div>
                </div>
                <span className="bar-value">{topic.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Level Distribution Donut Chart */}
        <div className="chart-card">
          <h3>
            <span className="chart-indicator red"></span> Level Distribution
          </h3>
          <div className="donut-chart-container">
            <div className="donut-chart">
              <svg viewBox="0 0 100 100">
                {/* Background circle */}
                <circle cx="50" cy="50" r="40" fill="none" stroke="#21262d" strokeWidth="15" />

                {/* Calculate segments */}
                {(() => {
                  const total = totalLevelCount || 1;
                  const beginner = levelDistribution.Beginner / total;
                  const intermediate = levelDistribution.Intermediate / total;
                  const advanced = levelDistribution.Advanced / total;

                  const circumference = 2 * Math.PI * 40;

                  let offset = 0;
                  const segments = [
                    { pct: beginner, color: "#3fb950", label: "Beginner" },
                    { pct: intermediate, color: "#f0a020", label: "Intermediate" },
                    { pct: advanced, color: "#f85149", label: "Advanced" },
                  ];

                  return segments.map((seg, i) => {
                    const dashLength = seg.pct * circumference;
                    const dashOffset = -offset * circumference;
                    offset += seg.pct;

                    return (
                      <circle
                        key={i}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="15"
                        strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                        strokeDashoffset={dashOffset}
                        transform="rotate(-90 50 50)"
                      />
                    );
                  });
                })()}
              </svg>
            </div>
            <div className="donut-legend">
              <div className="legend-item">
                <span className="legend-dot beginner"></span>
                Beginner ({levelDistribution.Beginner})
              </div>
              <div className="legend-item">
                <span className="legend-dot intermediate"></span>
                Intermediate ({levelDistribution.Intermediate})
              </div>
              <div className="legend-item">
                <span className="legend-dot advanced"></span>
                Advanced ({levelDistribution.Advanced})
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tag Cloud Section */}
      <div className="section-card">
        <h3>
          <span className="section-icon">🏷️</span> Tag Cloud
        </h3>
        <p className="section-desc">
          The 100 most used tags that power this learning system
          <div className="export-dropdown">
            <button
              className="export-btn"
              onClick={() => {
                // Export as CSV for LMS import
                const headers = ["Tag ID", "Tag Name", "Count", "Category", "Description"];
                const rows = tagCloud.map((tag) => [
                  tag.id || "",
                  tag.name || tag.label || "",
                  tag.count || 0,
                  tag.categoryPath || "",
                  (tag.description || "").replace(/,/g, ";"), // Escape commas
                ]);
                const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "tags.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              📥 Export CSV
            </button>
            <button
              className="export-btn"
              onClick={() => {
                // Export as JSON
                const data = JSON.stringify(tagCloud, null, 2);
                const blob = new Blob([data], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "tags.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              � Export JSON
            </button>
          </div>
        </p>
        <div className="tag-cloud">
          {tagCloud.map((tag, index) => (
            <span
              key={tag.id || tag.name || index}
              className="tag-pill"
              style={{ borderColor: getTagColor(tag, index) }}
            >
              <span className="tag-name" style={{ color: getTagColor(tag, index) }}>
                {tag.name || tag.label}
              </span>
              <span className="tag-count">({tag.count || 0})</span>
            </span>
          ))}
        </div>
      </div>

      {/* Coverage Recommendations Section */}
      <div className="section-card">
        <h3>
          <span className="section-icon">📋</span> Coverage Recommendations
        </h3>
        <div className="recommendations-grid">
          {recommendations.map((rec, index) => (
            <div key={index} className={`recommendation-card ${rec.type}`}>
              <div className="rec-type">{rec.type === "gap" ? "⚠ GAP" : "💡 OPPORTUNITY"}</div>
              <h4>{rec.title}</h4>
              <p>{rec.description}</p>
              <span className="rec-badge">{rec.badge}</span>
            </div>
          ))}
          {recommendations.length === 0 && (
            <div className="no-recommendations">
              ✅ Great coverage! No significant gaps identified.
            </div>
          )}
        </div>
      </div>

      {/* All Courses Table */}
      <div className="section-card">
        <h3>
          <span className="section-icon">📚</span> All Courses
        </h3>
        <div className="courses-table-wrapper">
          <table className="courses-table">
            <thead>
              <tr>
                <th onClick={() => handleSort("code")} className="sortable">
                  CODE {sortField === "code" && (sortDirection === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("title")} className="sortable">
                  TITLE {sortField === "title" && (sortDirection === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("level")} className="sortable">
                  LEVEL {sortField === "level" && (sortDirection === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("topic")} className="sortable">
                  TOPIC {sortField === "topic" && (sortDirection === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("industry")} className="sortable">
                  INDUSTRY {sortField === "industry" && (sortDirection === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => handleSort("video_count")} className="sortable">
                  VIDEOS {sortField === "video_count" && (sortDirection === "asc" ? "▲" : "▼")}
                </th>
                <th>AI</th>
              </tr>
            </thead>
            <tbody>
              {sortedCourses.map((course, index) => (
                <tr key={course.id || course.code || index}>
                  <td className="code-cell">{course.code || "—"}</td>
                  <td className="title-cell">{course.title || course.name || "Untitled"}</td>
                  <td>
                    <span className={getLevelClass(course.tags?.level)}>
                      {(course.tags?.level || "Intermediate").toUpperCase()}
                    </span>
                  </td>
                  <td>{course.tags?.topic || "General"}</td>
                  <td>{course.tags?.industry || "General"}</td>
                  <td className="videos-cell">{course.video_count || 0}</td>
                  <td className="ai-cell">
                    {course.has_ai_tags ? <span className="ai-check">✓</span> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="dashboard-footer">
        <p>
          📊 {tags?.length || 0} tags • {edges?.length || 0} tag connections •{" "}
          {Object.keys(industryDistribution).length} industries
        </p>
      </div>
    </div>
  );
}

export default Dashboard;
