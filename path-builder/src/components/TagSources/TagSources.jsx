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
  const { courses, tags } = useTagData();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [filter, setFilter] = useState("all"); // 'all' | 'enriched' | 'pending'

  // Analyze tag sources across all courses
  const analysis = useMemo(() => {
    let enriched = 0;
    let pending = 0;
    const baseTagCounts = {};
    const aiTagCounts = {};
    const videoTagCounts = {};

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

      // Count AI tags (Gemini system tags)
      if (course.gemini_system_tags) {
        course.gemini_system_tags.forEach((tag) => {
          aiTagCounts[tag] = (aiTagCounts[tag] || 0) + 1;
        });
      }

      // Count video-extracted tags (transcript + ai_tags)
      const videoTags = [
        ...(course.transcript_tags || []),
        ...(course.ai_tags || []),
      ];
      videoTags.forEach((tag) => {
        videoTagCounts[tag] = (videoTagCounts[tag] || 0) + 1;
      });
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
  const topVideoTags = getTopTags(analysis.videoTagCounts);

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

      {/* Tag Source Breakdown */}
      <div className="ts-sources-grid">
        {/* Base Tags */}
        <div className="ts-source-card">
          <h3>
            <span className="source-badge base">BASE</span>
            Manual Taxonomy
          </h3>
          <p className="ts-source-desc">
            Official tags assigned during content creation
          </p>
          <div className="tag-list">
            {topBaseTags.map(([tag, count]) => (
              <span key={tag} className="tag-chip base">
                {tag} <span className="count">{count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Video Tags */}
        <div className="ts-source-card">
          <h3>
            <span className="source-badge video">VIDEO</span>
            Video Extracted
          </h3>
          <p className="ts-source-desc">
            Keywords from video titles and transcript analysis
          </p>
          <div className="tag-list">
            {topVideoTags.map(([tag, count]) => (
              <span key={tag} className="tag-chip video">
                {tag} <span className="count">{count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* AI Tags */}
        <div className="ts-source-card">
          <h3>
            <span className="source-badge ai">AI</span>
            Gemini Enriched
          </h3>
          <p className="ts-source-desc">
            System tags identified by AI content analysis
          </p>
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
                  <span className="enrichment-badge enriched" title="AI enrichment complete">✅ AI</span>
                ) : (
                  <span className="enrichment-badge pending" title="Needs AI enrichment">⏳ Pending</span>
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
                      {course.tags?.topic && <span className="mini-tag base">{course.tags.topic}</span>}
                      {course.tags?.level && <span className="mini-tag base">{course.tags.level}</span>}
                      {course.tags?.industry && <span className="mini-tag base">{course.tags.industry}</span>}
                    </div>
                  </div>

                  {/* Video Tags */}
                  {(course.ai_tags?.length > 0 || course.transcript_tags?.length > 0) && (
                    <div className="tag-group">
                      <span className="tag-group-label video">VIDEO</span>
                      <div className="tag-group-items">
                        {course.ai_tags?.slice(0, 5).map((tag) => (
                          <span key={tag} className="mini-tag video">{tag}</span>
                        ))}
                        {course.transcript_tags?.slice(0, 3).map((tag) => (
                          <span key={tag} className="mini-tag video">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Tags */}
                  {course.gemini_system_tags?.length > 0 && (
                    <div className="tag-group">
                      <span className="tag-group-label ai">AI</span>
                      <div className="tag-group-items">
                        {course.gemini_system_tags.map((tag) => (
                          <span key={tag} className="mini-tag ai">{tag}</span>
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
          <div className="ts-more-hint">
            Showing first 50 of {filteredCourses.length} courses
          </div>
        )}
      </div>
    </div>
  );
}

export default TagSources;
