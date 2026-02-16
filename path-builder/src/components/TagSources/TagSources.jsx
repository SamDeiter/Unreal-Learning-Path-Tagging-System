import { useMemo, useState } from "react";
import { useTagData } from "../../context/TagDataContext";
import "./TagSources.css";

/**
 * Tag Sources Dashboard - shows clear delineation between tag sources:
 * 1. Base Tags (manual taxonomy)
 * 2. Video Tags (extracted from titles/transcripts)
 * 3. AI Tags (Gemini-enriched)
 */
function TagSources() {
  const { courses } = useTagData();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [filter, setFilter] = useState("all"); // 'all' | 'enriched' | 'pending'
  const [showAllVideoTags, setShowAllVideoTags] = useState(false);
  const [videoTagLimit, setVideoTagLimit] = useState(15); // 15, 100, or 'all'

  // Analyze tag sources across all courses
  const analysis = useMemo(() => {
    let enriched = 0;
    let pending = 0;
    const baseTagCounts = Object.create(null);
    const aiTagCounts = Object.create(null);
    const videoTagCounts = Object.create(null);

    courses.forEach((course) => {
      // Count enrichment status
      if (course.gemini_enriched) {
        enriched++;
      } else {
        pending++;
      }

      // Count base tags (from tags object)
      if (course.tags) {
        Object.entries(course.tags).forEach(([key, value]) => {
          if (key !== "_confidence" && value) {
            baseTagCounts[value] = (baseTagCounts[value] || 0) + 1;
          }
        });
      }

      // Count AI tags (from enrichment pipeline)
      if (course.ai_tags) {
        const rawAI = Array.isArray(course.ai_tags)
          ? course.ai_tags
          : Object.values(course.ai_tags);
        rawAI.forEach((tag) => {
          const key = typeof tag === "string" ? tag : tag?.tag_id || tag?.name;
          if (key) aiTagCounts[key] = (aiTagCounts[key] || 0) + 1;
        });
      }

      // Split dotted canonical_tags into individual tags
      // e.g. "rendering.material" → ["Rendering", "Material"]
      const splitTag = (tag) => {
        if (tag.includes(".")) {
          return tag.split(".").map((w) => w.charAt(0).toUpperCase() + w.slice(1));
        }
        return [tag];
      };

      // Quality filter: reject noise tags
      const TAG_STOPWORDS = new Set([
        "using",
        "creating",
        "button",
        "notes",
        "release",
        "focus",
        "orlando",
        "fest",
        "click",
        "select",
        "open",
        "make",
        "made",
        "show",
        "look",
        "know",
        "want",
        "need",
        "take",
        "going",
        "right",
        "left",
        "back",
        "just",
        "like",
        "also",
        "well",
        "really",
        "thing",
        "things",
        "way",
        "actually",
        "basically",
        "different",
        "example",
        "here",
        "inside",
        "called",
        "got",
        "put",
        "done",
        "let",
        "run",
        "set",
        "top",
        "end",
        "new",
        "now",
        "not",
        "get",
        "see",
        "use",
        "two",
        "one",
        "bit",
        "lot",
        "big",
        "kind",
        "sort",
        "part",
        "able",
      ]);
      const SPECIAL_CHARS = /[^a-zA-Z0-9_\- ]/;
      const isValidTag = (tag) => {
        if (!tag || tag.length < 3) return false;
        if (SPECIAL_CHARS.test(tag)) return false;
        if (TAG_STOPWORDS.has(tag.toLowerCase())) return false;
        if (/^\d+$/.test(tag)) return false; // pure numbers
        return true;
      };

      const videoTags = [
        ...(course.canonical_tags || []).flatMap(splitTag),
        ...(course.transcript_tags || []).flatMap(splitTag),
        ...(course.extracted_tags || []),
        ...(Array.isArray(course.ai_tags)
          ? course.ai_tags
          : course.ai_tags
            ? Object.values(course.ai_tags)
            : []
        )
          .map((t) => (typeof t === "string" ? t : t?.tag_id || t?.name || ""))
          .filter(Boolean),
      ];
      // Also include all tags dict values (topic, industry, level, etc.)
      const tagsObj = course.tags || {};
      Object.entries(tagsObj).forEach(([key, val]) => {
        if (key.startsWith("_")) return; // skip internal fields
        if (Array.isArray(val)) {
          videoTags.push(...val);
        } else if (typeof val === "string" && val) {
          videoTags.push(val);
        }
      });
      videoTags.filter(isValidTag).forEach((tag) => {
        videoTagCounts[tag] = (videoTagCounts[tag] || 0) + 1;
      });
    });

    // Post-count: remove tags appearing in fewer than 3 courses (noise)
    const MIN_FREQUENCY = 3;
    Object.keys(videoTagCounts).forEach((tag) => {
      if (videoTagCounts[tag] < MIN_FREQUENCY) {
        delete videoTagCounts[tag];
      }
    });

    return {
      enriched,
      pending,
      total: courses.length,
      baseTagCounts,
      aiTagCounts,
      videoTagCounts,
    };
  }, [courses]);

  // Filter courses
  const filteredCourses = useMemo(() => {
    if (filter === "enriched") {
      return courses.filter((c) => c.gemini_enriched);
    }
    if (filter === "pending") {
      return courses.filter((c) => !c.gemini_enriched);
    }
    return courses;
  }, [courses, filter]);

  // Get top tags by source
  const getTopTags = (counts, limit = 15) => {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  };

  const topBaseTags = getTopTags(analysis.baseTagCounts);
  const topAITags = getTopTags(analysis.aiTagCounts);

  // Get all video tags sorted by frequency
  const allVideoTags = useMemo(() => {
    return Object.entries(analysis.videoTagCounts).sort((a, b) => b[1] - a[1]);
  }, [analysis.videoTagCounts]);

  const displayedVideoTags =
    videoTagLimit === "all" ? allVideoTags : allVideoTags.slice(0, videoTagLimit);

  // Tag export data
  const tagExportData = useMemo(() => {
    const uniqueBaseTags = Object.keys(analysis.baseTagCounts).length;
    const uniqueVideoTags = Object.keys(analysis.videoTagCounts).length;
    const uniqueAITags = Object.keys(analysis.aiTagCounts).length;

    const totalBaseUsage = Object.values(analysis.baseTagCounts).reduce((a, b) => a + b, 0);
    const totalVideoUsage = Object.values(analysis.videoTagCounts).reduce((a, b) => a + b, 0);
    const totalAIUsage = Object.values(analysis.aiTagCounts).reduce((a, b) => a + b, 0);

    return {
      uniqueBaseTags,
      uniqueVideoTags,
      uniqueAITags,
      totalBaseTags: totalBaseUsage,
      totalVideoTags: totalVideoUsage,
      totalAITags: totalAIUsage,
      grandTotal: uniqueBaseTags + uniqueVideoTags + uniqueAITags,
    };
  }, [analysis]);

  // Export tags to CSV
  const exportTags = (source) => {
    let tags;
    let filename;

    switch (source) {
      case "base":
        tags = analysis.baseTagCounts;
        filename = "base_tags_export.csv";
        break;
      case "video":
        tags = analysis.videoTagCounts;
        filename = "video_extracted_tags_export.csv";
        break;
      case "ai":
        tags = analysis.aiTagCounts;
        filename = "ai_tags_export.csv";
        break;
      default:
        // Export all
        tags = { ...analysis.baseTagCounts, ...analysis.videoTagCounts, ...analysis.aiTagCounts };
        filename = "all_tags_export.csv";
    }

    const csvContent =
      "Tag,Count,Source\n" +
      Object.entries(tags)
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => `"${tag}",${count},${source}`)
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tag-sources">
      {/* Header */}
      <div className="ts-header">
        <h2>🏷️ Tag Source Analysis</h2>
        <p>Understand the origin and coverage of tags across your content</p>
      </div>

      {/* Enrichment Status */}
      <div className="ts-status-row">
        <div
          className={`ts-status-card ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          <div className="ts-status-value">{analysis.total}</div>
          <div className="ts-status-label">Total Courses</div>
        </div>
        <div
          className={`ts-status-card enriched ${filter === "enriched" ? "active" : ""}`}
          onClick={() => setFilter("enriched")}
        >
          <div className="ts-status-value">{analysis.enriched}</div>
          <div className="ts-status-label">AI Enriched</div>
          <div className="ts-status-pct">
            {Math.round((analysis.enriched / analysis.total) * 100)}%
          </div>
        </div>
        <div
          className={`ts-status-card pending ${filter === "pending" ? "active" : ""}`}
          onClick={() => setFilter("pending")}
          title="These courses need AI enrichment — run the transcript analyzer"
        >
          <div className="ts-status-value">{analysis.pending}</div>
          <div className="ts-status-label">Pending AI</div>
          <div className="ts-status-hint">Click to see which need processing</div>
        </div>
      </div>

      {/* Tag Source Legend */}
      <div className="ts-legend">
        <div className="legend-item">
          <span className="legend-badge base">BASE</span>
          <span>Manual taxonomy (topic, level, product)</span>
        </div>
        <div className="legend-item">
          <span className="legend-badge video">VIDEO</span>
          <span>Extracted from video titles & transcripts</span>
        </div>
        <div className="legend-item">
          <span className="legend-badge ai">AI</span>
          <span>Gemini-analyzed from content</span>
        </div>
      </div>

      {/* Tag Export Stats */}
      <div className="ts-export-stats">
        <div className="export-header">
          <h3>📊 Tag Generation Summary</h3>
          <button className="export-all-btn" onClick={() => exportTags("all")}>
            ⬇️ Export All Tags (CSV)
          </button>
        </div>
        <div className="export-grid">
          <div className="export-stat base">
            <div className="stat-label">BASE Tags</div>
            <div className="stat-value">{tagExportData.uniqueBaseTags}</div>
            <div className="stat-usage">{tagExportData.totalBaseTags} total uses</div>
            <button className="export-btn" onClick={() => exportTags("base")}>
              Export
            </button>
          </div>
          <div className="export-stat video">
            <div className="stat-label">VIDEO Tags</div>
            <div className="stat-value">{tagExportData.uniqueVideoTags}</div>
            <div className="stat-usage">{tagExportData.totalVideoTags} total uses</div>
            <button className="export-btn" onClick={() => exportTags("video")}>
              Export
            </button>
          </div>
          <div className="export-stat ai">
            <div className="stat-label">AI Tags</div>
            <div className="stat-value">{tagExportData.uniqueAITags}</div>
            <div className="stat-usage">{tagExportData.totalAITags} total uses</div>
            <button className="export-btn" onClick={() => exportTags("ai")}>
              Export
            </button>
          </div>
        </div>
        <div className="export-total">
          Grand Total: <strong>{tagExportData.grandTotal}</strong> unique tags generated
        </div>
      </div>

      {/* Tag Source Breakdown */}
      <div className="ts-sources-grid">
        {/* Base Tags */}
        <div className="ts-source-card">
          <h3>
            <span className="source-badge base">BASE</span>
            Manual Taxonomy
            <span className="source-total">
              {Object.keys(analysis.baseTagCounts).length} unique tags
            </span>
          </h3>
          <p className="ts-source-desc">Official tags assigned during content creation</p>
          <div className="tag-list">
            {topBaseTags.map(([tag, count]) => (
              <span key={tag} className="tag-chip base">
                {tag} <span className="count">{count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Video Tags - Expandable */}
        <div className={`ts-source-card ${showAllVideoTags ? "expanded" : ""}`}>
          <h3>
            <span className="source-badge video">VIDEO</span>
            Video Extracted
            <span className="source-total">{allVideoTags.length} unique tags</span>
          </h3>
          <p className="ts-source-desc">Keywords from video titles and transcript analysis</p>

          {/* Tag limit controls */}
          <div className="tag-limit-controls">
            <span>Show:</span>
            <button
              className={videoTagLimit === 15 ? "active" : ""}
              onClick={() => {
                setVideoTagLimit(15);
                setShowAllVideoTags(false);
              }}
            >
              Top 15
            </button>
            <button
              className={videoTagLimit === 100 ? "active" : ""}
              onClick={() => {
                setVideoTagLimit(100);
                setShowAllVideoTags(true);
              }}
            >
              Top 100
            </button>
            <button
              className={videoTagLimit === "all" ? "active" : ""}
              onClick={() => {
                setVideoTagLimit("all");
                setShowAllVideoTags(true);
              }}
            >
              All ({allVideoTags.length})
            </button>
          </div>

          {allVideoTags.length === 0 ? (
            <div className="no-tags-warning">
              ⚠️ No video-extracted tags found. Check if <code>ai_tags</code> or{" "}
              <code>transcript_tags</code> fields exist in your data.
            </div>
          ) : (
            <div className={`tag-list ${showAllVideoTags ? "expanded" : ""}`}>
              {displayedVideoTags.map(([tag, count]) => (
                <span key={tag} className="tag-chip video">
                  {tag} <span className="count">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AI Tags */}
        <div className="ts-source-card">
          <h3>
            <span className="source-badge ai">AI</span>
            Gemini Enriched
            <span className="source-total">
              {Object.keys(analysis.aiTagCounts).length} unique tags
            </span>
          </h3>
          <p className="ts-source-desc">System tags identified by AI content analysis</p>
          <div className="tag-list">
            {topAITags.map(([tag, count]) => (
              <span key={tag} className="tag-chip ai">
                {tag} <span className="count">{count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Course List */}
      <div className="ts-section">
        <h3>
          📋 {filter === "pending" ? "Courses Needing AI Enrichment" : "All Courses"}
          <span className="course-count">({filteredCourses.length})</span>
        </h3>
        {filter === "pending" && (
          <div className="ts-action-hint">
            💡 Run <code>npm run analyze:transcripts</code> to generate AI tags for these courses
          </div>
        )}
        <div className="ts-course-grid">
          {filteredCourses.slice(0, 50).map((course) => (
            <div
              key={course.code}
              className={`ts-course-card ${selectedCourse === course.code ? "selected" : ""}`}
              onClick={() => setSelectedCourse(selectedCourse === course.code ? null : course.code)}
            >
              <div className="ts-course-header">
                <span className="course-code">{course.code}</span>
                {course.gemini_enriched ? (
                  <span className="enrichment-badge enriched" title="AI enrichment complete">
                    ✅ AI
                  </span>
                ) : (
                  <span className="enrichment-badge pending" title="Needs AI enrichment">
                    ⏳ Pending
                  </span>
                )}
              </div>
              <div className="ts-course-title">{course.title}</div>

              {/* Show tag breakdown when selected */}
              {selectedCourse === course.code && (
                <div className="ts-course-tags">
                  {/* Base Tags */}
                  <div className="tag-group">
                    <span className="tag-group-label base">BASE</span>
                    <div className="tag-group-items">
                      {course.tags?.topic && (
                        <span className="mini-tag base">{course.tags.topic}</span>
                      )}
                      {course.tags?.level && (
                        <span className="mini-tag base">{course.tags.level}</span>
                      )}
                      {course.tags?.industry && (
                        <span className="mini-tag base">{course.tags.industry}</span>
                      )}
                    </div>
                  </div>

                  {/* Video Tags */}
                  {(course.ai_tags?.length > 0 || course.transcript_tags?.length > 0) && (
                    <div className="tag-group">
                      <span className="tag-group-label video">VIDEO</span>
                      <div className="tag-group-items">
                        {course.ai_tags?.slice(0, 5).map((tag) => (
                          <span key={tag} className="mini-tag video">
                            {tag}
                          </span>
                        ))}
                        {course.transcript_tags?.slice(0, 3).map((tag) => (
                          <span key={tag} className="mini-tag video">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Tags */}
                  {course.ai_tags?.length > 0 && (
                    <div className="tag-group">
                      <span className="tag-group-label ai">AI</span>
                      <div className="tag-group-items">
                        {course.ai_tags.map((tag) => (
                          <span key={tag} className="mini-tag ai">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!course.gemini_enriched && (
                    <div className="missing-ai-note">
                      ⚠️ No AI analysis yet — add to processing queue
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {filteredCourses.length > 50 && (
          <div className="ts-more-hint">Showing first 50 of {filteredCourses.length} courses</div>
        )}
      </div>
    </div>
  );
}

export default TagSources;
