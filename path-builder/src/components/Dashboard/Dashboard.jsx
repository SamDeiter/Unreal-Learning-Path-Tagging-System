import { useMemo, useState } from "react";
import { useTagData } from "../../context/TagDataContext";
import { getAllPersonas, personaScoringRules } from "../../services/PersonaService";
import VertexAIMonitor from "../VertexAIMonitor/VertexAIMonitor";
import "./Dashboard.css";

/**
 * Coverage Dashboard - displays stats cards, charts, tag cloud,
 * recommendations, and courses table for the course library
 */
function Dashboard() {
  const { courses, tags, edges, lastUpdated } = useTagData();
  const [sortField, setSortField] = useState("code");
  const [sortDirection, setSortDirection] = useState("asc");
  const [showMissingVideos, setShowMissingVideos] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [courseSearch, setCourseSearch] = useState("");

  // Calculate stats
  const stats = useMemo(() => {
    const totalCourses = courses.length;
    const totalVideos = courses.reduce((sum, c) => sum + (c.video_count || 0), 0);
    const coursesWithVideos = courses.filter((c) => c.video_count > 0).length;
    const aiEnriched = courses.filter((c) => c.gemini_enriched).length;

    return { totalCourses, totalVideos, coursesWithVideos, aiEnriched };
  }, [courses]);

  // Readiness Score (Option B)
  const readinessScore = useMemo(() => {
    if (courses.length === 0) return 0;
    const hasVideos = courses.filter((c) => c.video_count > 0).length;
    const hasAI = courses.filter((c) => c.gemini_enriched).length;
    const hasTags = courses.filter(
      (c) => c.tags?.level && c.tags?.topic && c.tags?.industry
    ).length;
    // Weighted: 40% videos, 30% AI, 30% tags
    return Math.round(
      (hasVideos / courses.length) * 40 +
        (hasAI / courses.length) * 30 +
        (hasTags / courses.length) * 30
    );
  }, [courses]);

  // Persona Distribution (Option D) — keyword-scored
  const personaDistribution = useMemo(() => {
    const allPersonas = getAllPersonas();
    const counts = {};
    allPersonas.forEach((p) => {
      counts[p.id] = 0;
    });

    courses.forEach((course) => {
      const text = [
        course.title || course.name || "",
        course.tags?.topic || "",
        course.tags?.industry || "",
      ]
        .join(" ")
        .toLowerCase();

      let bestPersona = null;
      let bestScore = 0;

      Object.entries(personaScoringRules).forEach(([pid, rules]) => {
        let score = 0;
        (rules.boostKeywords || []).forEach((kw) => {
          if (text.includes(kw.toLowerCase())) score += 1;
        });
        if (score > bestScore) {
          bestScore = score;
          bestPersona = pid;
        }
      });

      if (bestPersona && bestScore > 0) {
        counts[bestPersona] = (counts[bestPersona] || 0) + 1;
      }
    });

    return allPersonas
      .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, count: counts[p.id] || 0 }))
      .sort((a, b) => b.count - a.count);
  }, [courses]);

  // Calculate source distribution
  const sourceDistribution = useMemo(() => {
    const youtube = courses.filter((c) => c.source === "youtube").length;
    const docs = courses.filter((c) => c.source === "epic_docs").length;
    const lms = courses.filter((c) => !c.source).length;
    return { youtube, docs, lms };
  }, [courses]);

  // Filter courses by source
  const filteredCourses = useMemo(() => {
    if (sourceFilter === "all") return courses;
    if (sourceFilter === "youtube") return courses.filter((c) => c.source === "youtube");
    if (sourceFilter === "docs") return courses.filter((c) => c.source === "epic_docs");
    if (sourceFilter === "lms") return courses.filter((c) => !c.source);
    return courses;
  }, [courses, sourceFilter]);

  // Calculate topic distribution (from courses) - excludes "Other" from chart
  const topicDistribution = useMemo(() => {
    if (!filteredCourses || filteredCourses.length === 0) return [];

    // Group courses by topic (check both course.topic and course.tags?.topic)
    const topics = {};
    filteredCourses.forEach((course) => {
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
  }, [filteredCourses]);

  // Calculate level distribution
  const levelDistribution = useMemo(() => {
    const levels = { Beginner: 0, Intermediate: 0, Advanced: 0 };
    filteredCourses.forEach((course) => {
      const level = course.tags?.level || "Intermediate";
      if (levels[level] !== undefined) {
        levels[level]++;
      }
    });
    return levels;
  }, [filteredCourses]);

  // Get top 100 tags for Tag Cloud — use pre-computed counts from App.jsx
  const tagCloud = useMemo(() => {
    if (!tags || tags.length === 0) return [];

    return [...tags]
      .filter((t) => (t.count || 0) > 0)
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 100);
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
    return [...filteredCourses].sort((a, b) => {
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
  }, [filteredCourses, sortField, sortDirection]);

  // Split courses by video availability
  const coursesWithVideos = sortedCourses.filter((c) => (c.video_count || 0) > 0);
  const coursesMissingVideos = sortedCourses.filter((c) => (c.video_count || 0) === 0);

  // Quick Search filter (Option C)
  const displayedCourses = useMemo(() => {
    if (!courseSearch.trim()) return coursesWithVideos;
    const q = courseSearch.toLowerCase();
    return coursesWithVideos.filter(
      (c) =>
        (c.code || "").toLowerCase().includes(q) ||
        (c.title || c.name || "").toLowerCase().includes(q) ||
        (c.tags?.topic || "").toLowerCase().includes(q)
    );
  }, [coursesWithVideos, courseSearch]);

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
        <div
          className="stat-card primary"
          title="Total number of learning paths and courses in the library, across all sources"
        >
          <div className="stat-number">{stats.totalCourses}</div>
          <div className="stat-label">TOTAL COURSES</div>
        </div>
        <div
          className="stat-card source-yt"
          onClick={() => setSourceFilter(sourceFilter === "youtube" ? "all" : "youtube")}
          style={{
            cursor: "pointer",
            outline: sourceFilter === "youtube" ? "2px solid #f85149" : "none",
          }}
          title="YouTube videos imported from official Epic Games and community channels. Click to filter."
        >
          <div className="stat-number">{sourceDistribution.youtube}</div>
          <div className="stat-label">▶ YOUTUBE</div>
        </div>
        <div
          className="stat-card source-lms"
          onClick={() => setSourceFilter(sourceFilter === "lms" ? "all" : "lms")}
          style={{
            cursor: "pointer",
            outline: sourceFilter === "lms" ? "2px solid #3fb950" : "none",
          }}
          title="Courses from Epic’s official Learning Management System (dev.epicgames.com). Click to filter."
        >
          <div className="stat-number">{sourceDistribution.lms}</div>
          <div className="stat-label">🎓 EPIC LMS</div>
        </div>
        <div
          className="stat-card source-docs"
          onClick={() => setSourceFilter(sourceFilter === "docs" ? "all" : "docs")}
          style={{
            cursor: "pointer",
            outline: sourceFilter === "docs" ? "2px solid #58a6ff" : "none",
          }}
          title="Documentation pages from Epic’s official Unreal Engine docs. Click to filter."
        >
          <div className="stat-number">{sourceDistribution.docs}</div>
          <div className="stat-label">📖 EPIC DOCS</div>
        </div>
        <div
          className="stat-card accent"
          title="Courses that have been processed by Gemini AI for auto-tagging, summaries, and enrichment"
        >
          <div className="stat-number">{stats.aiEnriched}</div>
          <div className="stat-label">AI-ENRICHED</div>
        </div>
        <div
          className="stat-card readiness"
          title="Library completeness score: 40% weight for courses with videos, 30% for AI enrichment, 30% for complete tags (level + topic + industry)"
        >
          <div className="stat-number">{readinessScore}%</div>
          <div className="stat-label">READINESS</div>
          <div className="readiness-bar">
            <div className="readiness-fill" style={{ width: `${readinessScore}%` }} />
          </div>
        </div>
      </div>

      {/* Source Filter Bar */}
      {sourceFilter !== "all" && (
        <div className="source-filter-bar">
          <span>
            Filtering:{" "}
            <strong>
              {sourceFilter === "youtube"
                ? "▶ YouTube"
                : sourceFilter === "lms"
                  ? "🎓 Epic LMS"
                  : "📖 Epic Docs"}
            </strong>{" "}
            ({filteredCourses.length} courses)
          </span>
          <button className="clear-filter-btn" onClick={() => setSourceFilter("all")}>
            ✕ Clear Filter
          </button>
        </div>
      )}

      {/* Charts Row */}
      <div className="charts-row">
        {/* Topic Distribution Bar Chart */}
        <div className="chart-card">
          <h3 title="Number of courses grouped by their primary UE5 topic area">
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

        {/* Persona Distribution Chart (Option D) */}
        <div className="chart-card">
          <h3 title="How many courses serve each learner persona, based on the course’s industry tag. Personas with 0 courses represent gaps in coverage.">
            <span className="chart-indicator purple" /> Persona Coverage
          </h3>
          <div className="bar-chart">
            {personaDistribution.map((p) => {
              const maxP = personaDistribution[0]?.count || 1;
              return (
                <div key={p.id} className="bar-row">
                  <span className="bar-label">
                    {p.emoji} {p.name}
                  </span>
                  <div className="bar-container">
                    <div
                      className="bar-fill persona-bar"
                      style={{ width: `${(p.count / maxP) * 100}%` }}
                    />
                  </div>
                  <span className="bar-value">{p.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Level Distribution Donut Chart */}
        <div className="chart-card">
          <h3 title="Breakdown of courses by difficulty level: Beginner, Intermediate, and Advanced">
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
              <div
                className="legend-item"
                title={`${levelDistribution.Beginner} courses for learners new to the topic`}
              >
                <span className="legend-dot beginner"></span>
                <span className="legend-text">Beginner</span>
                <span className="legend-value">
                  {levelDistribution.Beginner} (
                  {totalLevelCount > 0
                    ? Math.round((levelDistribution.Beginner / totalLevelCount) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div
                className="legend-item"
                title={`${levelDistribution.Intermediate} courses for learners with some experience`}
              >
                <span className="legend-dot intermediate"></span>
                <span className="legend-text">Intermediate</span>
                <span className="legend-value">
                  {levelDistribution.Intermediate} (
                  {totalLevelCount > 0
                    ? Math.round((levelDistribution.Intermediate / totalLevelCount) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div
                className="legend-item"
                title={`${levelDistribution.Advanced} courses for expert-level learners`}
              >
                <span className="legend-dot advanced"></span>
                <span className="legend-text">Advanced</span>
                <span className="legend-value">
                  {levelDistribution.Advanced} (
                  {totalLevelCount > 0
                    ? Math.round((levelDistribution.Advanced / totalLevelCount) * 100)
                    : 0}
                  %)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tag Cloud Section */}
      <div className="section-card">
        <h3 title="Most frequently used tags across all courses. Larger count = more courses tagged with that term. Export for LMS import.">
          <span className="section-icon">🏷️</span> Tag Cloud
        </h3>
        <div className="section-desc">
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
              📄 Export JSON
            </button>
          </div>
        </div>
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
        <h3 title="Auto-detected gaps in your library: topics with low coverage and missing difficulty levels for complete learning paths">
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
        <h3 title="Sortable table of every course with video content. Click column headers to sort. Use the search bar to filter.">
          <span className="section-icon">📚</span> All Courses
        </h3>
        {/* Quick Search (Option C) */}
        <div className="course-search-bar">
          <input
            type="text"
            className="course-search-input"
            placeholder="🔍 Search courses by name, code, or topic…"
            value={courseSearch}
            onChange={(e) => setCourseSearch(e.target.value)}
          />
          {courseSearch && (
            <button className="course-search-clear" onClick={() => setCourseSearch("")}>
              ✕
            </button>
          )}
        </div>
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
                <th>SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {displayedCourses.map((course, index) => (
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
                  <td className="videos-cell">{course.video_count}</td>
                  <td className="ai-cell">
                    {course.gemini_enriched ? <span className="ai-check">✓</span> : "—"}
                  </td>
                  <td>
                    <span className={`source-badge source-${course.source || "lms"}`}>
                      {course.source === "youtube"
                        ? "▶ YT"
                        : course.source === "epic_docs"
                          ? "📖 Doc"
                          : "🎓 LMS"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Missing Videos Section */}
          {coursesMissingVideos.length > 0 && (
            <div className="missing-videos-section">
              <button
                className="missing-videos-toggle"
                onClick={() => setShowMissingVideos(!showMissingVideos)}
              >
                ⚠️ Missing Videos ({coursesMissingVideos.length} courses)
                <span className="toggle-icon">{showMissingVideos ? "▲" : "▼"}</span>
              </button>
              {showMissingVideos && (
                <table className="courses-table missing-videos-table">
                  <thead>
                    <tr>
                      <th>CODE</th>
                      <th>TITLE</th>
                      <th>LEVEL</th>
                      <th>TOPIC</th>
                      <th>INDUSTRY</th>
                      <th>AI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coursesMissingVideos.map((course, index) => (
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
                        <td className="ai-cell">
                          {course.gemini_enriched ? <span className="ai-check">✓</span> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="dashboard-footer">
        <p>
          📊 {tags?.length || 0} tags • {edges?.length || 0} tag connections •{" "}
          {Object.keys(industryDistribution).length} industries
          {lastUpdated && (
            <span className="last-updated">
              {" "}
              • 🕐 Last updated:{" "}
              {new Date(lastUpdated).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </p>
      </div>

      {/* 🔍 Vertex AI Search Monitor */}
      <VertexAIMonitor />
    </div>
  );
}

export default Dashboard;
