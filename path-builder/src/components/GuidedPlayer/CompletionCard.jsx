/**
 * CompletionCard — End-of-path summary with stats, AI key takeaways, and reflection.
 */
import { useEffect, useState } from "react";
import PropTypes from "prop-types";

/**
 * Extracts unique topics from all courses in the completed path.
 */
function collectTopics(courses) {
  const seen = new Set();
  for (const c of courses) {
    (c.ai_tags || []).forEach((t) => seen.add(t));
    (c._matchedKeywords || []).forEach((t) => seen.add(t));
  }
  return [...seen].slice(0, 8);
}

/**
 * Builds per-course takeaway data from existing enrichment fields.
 * No API calls — uses gemini_outcomes, ai_tags, and titles already on course objects.
 */
function buildTakeaways(courses) {
  return courses
    .map((c) => {
      const outcomes = c.gemini_outcomes || [];
      const title = c.title || c.name || c.videos?.[0]?.title || "Lesson";
      return {
        title: title.replace(/\s+Part\s+[A-Z]$/i, "").trim(),
        outcomes: outcomes.slice(0, 3),
        courseCode: c.code,
      };
    })
    .filter((t) => t.outcomes.length > 0);
}

export default function CompletionCard({
  courses,
  totalDuration,
  reflectionText,
  onReflectionChange,
  wordCount,
  onFinish,
  onBackToPath,
  problemSummary,
}) {
  const [showAllTakeaways, setShowAllTakeaways] = useState(false);

  // Auto-save reflection to localStorage as user types
  useEffect(() => {
    if (reflectionText.trim()) {
      try {
        localStorage.setItem(
          "lp_reflection_draft",
          JSON.stringify({
            text: reflectionText,
            timestamp: Date.now(),
            courseCount: courses.length,
          })
        );
      } catch {
        /* storage full — silently ignore */
      }
    }
  }, [reflectionText, courses.length]);

  // Load saved draft on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("lp_reflection_draft") || "null");
      if (saved?.text && !reflectionText) {
        onReflectionChange(saved.text);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topics = collectTopics(courses);
  const takeaways = buildTakeaways(courses);
  const visibleTakeaways = showAllTakeaways ? takeaways : takeaways.slice(0, 3);

  // Total video count across all courses
  const totalVideos = courses.reduce((sum, c) => sum + (c.videos?.length || 1), 0);

  return (
    <div className="complete-card">
      {/* ── Header ── */}
      <div className="complete-icon">🎉</div>
      <h2>Path Complete!</h2>
      {problemSummary && (
        <p className="complete-problem-context">
          You explored: <strong>{problemSummary}</strong>
        </p>
      )}
      <p>You&apos;ve learned the skills to solve this problem and similar ones in the future.</p>

      {/* ── Stats Dashboard ── */}
      <div className="complete-stats-grid">
        <div className="stat-card">
          <span className="stat-icon">📚</span>
          <span className="stat-value">{courses.length}</span>
          <span className="stat-label">Lessons</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🎬</span>
          <span className="stat-value">{totalVideos}</span>
          <span className="stat-label">Videos</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⏱</span>
          <span className="stat-value">{totalDuration || "—"}</span>
          <span className="stat-label">Total Time</span>
        </div>
        {topics.length > 0 && (
          <div className="stat-card">
            <span className="stat-icon">🏷️</span>
            <span className="stat-value">{topics.length}</span>
            <span className="stat-label">Topics</span>
          </div>
        )}
      </div>

      {/* ── Key Takeaways (from gemini_outcomes, no API call) ── */}
      {takeaways.length > 0 && (
        <div className="complete-takeaways">
          <h3>🎯 Key Takeaways</h3>
          <div className="takeaway-list">
            {visibleTakeaways.map((t, i) => (
              <div key={t.courseCode || i} className="takeaway-card">
                <h4 className="takeaway-title">
                  <span className="takeaway-number">{i + 1}</span>
                  {t.title}
                </h4>
                <ul className="takeaway-outcomes">
                  {t.outcomes.map((o, j) => (
                    <li key={j}>{o}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {takeaways.length > 3 && (
            <button className="show-more-takeaways" onClick={() => setShowAllTakeaways((v) => !v)}>
              {showAllTakeaways ? "Show less" : `Show ${takeaways.length - 3} more`}
            </button>
          )}
        </div>
      )}

      {/* ── Topics Covered ── */}
      {topics.length > 0 && (
        <div className="complete-topics">
          <h3>🏷️ Topics Covered</h3>
          <div className="topic-chips">
            {topics.map((t) => (
              <span key={t} className="topic-chip">
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Reflection Prompt ── */}
      <div className="reflection-area">
        <h3>📝 What was your main takeaway?</h3>
        <p className="reflection-subtitle">
          Writing your reflection helps cement what you learned.
        </p>
        <textarea
          className="reflection-input"
          placeholder="I learned that..."
          value={reflectionText}
          onChange={(e) => onReflectionChange(e.target.value)}
          rows={4}
        />
        <div className="reflection-meta">
          {wordCount === 0 && <span className="word-hint">Try writing a few sentences</span>}
          {wordCount > 0 && wordCount < 10 && (
            <span className="word-hint">{wordCount} words — keep going!</span>
          )}
          {wordCount >= 10 && <span className="word-hint done">Great reflection! ✓</span>}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="completion-actions">
        <button
          className="finish-btn"
          onClick={() => {
            onFinish();
            try {
              localStorage.removeItem("lp_reflection_draft");
            } catch {
              /* ignore */
            }
          }}
        >
          {reflectionText.trim() ? "Save & Finish" : "Back to Problems"}
        </button>
        {onBackToPath && (
          <button className="back-to-path-btn" onClick={onBackToPath}>
            ← Back to Learning Path
          </button>
        )}
      </div>
    </div>
  );
}

CompletionCard.propTypes = {
  courses: PropTypes.array.isRequired,
  totalDuration: PropTypes.string,
  reflectionText: PropTypes.string.isRequired,
  onReflectionChange: PropTypes.func.isRequired,
  wordCount: PropTypes.number.isRequired,
  onFinish: PropTypes.func.isRequired,
  onBackToPath: PropTypes.func,
  problemSummary: PropTypes.string,
};
