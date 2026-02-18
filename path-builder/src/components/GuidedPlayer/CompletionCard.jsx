/**
 * CompletionCard — End-of-path summary with Fix Recipe, stats, and reflection.
 *
 * Redesigned to surface actionable "if you see this again, do X" guidance
 * using fixRecipe data (from answerData) and microLesson (from Gemini).
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
 * Merges fix steps from answerData.fixRecipe and microLesson.quick_fix,
 * preferring fixRecipe (more structured) then filling with quick_fix steps.
 */
function mergeFixSteps(fixRecipe, microLesson) {
  const steps = [];
  const seen = new Set();

  // Primary: answerData fixSteps
  if (fixRecipe?.fixSteps?.length > 0) {
    for (const step of fixRecipe.fixSteps) {
      const text = typeof step === "string" ? step : step.text || step.description || "";
      if (text && !seen.has(text.toLowerCase().slice(0, 60))) {
        seen.add(text.toLowerCase().slice(0, 60));
        steps.push(text);
      }
    }
  }

  // Secondary: microLesson quick_fix steps (fill gaps)
  if (microLesson?.quick_fix?.steps?.length > 0) {
    for (const step of microLesson.quick_fix.steps) {
      const text = typeof step === "string" ? step : step.text || step.action || "";
      if (text && !seen.has(text.toLowerCase().slice(0, 60))) {
        seen.add(text.toLowerCase().slice(0, 60));
        steps.push(text);
      }
    }
  }

  return steps;
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
  fixRecipe,
  microLesson,
}) {
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
  const totalVideos = courses.reduce((sum, c) => sum + (c.videos?.length || 1), 0);

  // ── Build fix recipe data ──
  const rootCause = fixRecipe?.mostLikelyCause || microLesson?.why_it_works?.explanation || null;
  const fixSteps = mergeFixSteps(fixRecipe, microLesson);
  const fastChecks = fixRecipe?.fastChecks || [];
  const relatedSituations = microLesson?.related_situations || [];
  const hasFixRecipe = rootCause || fixSteps.length > 0 || fastChecks.length > 0;

  // ── Copy-to-clipboard state ──
  const [copied, setCopied] = useState(false);
  const handleCopyRecipe = () => {
    const lines = [];
    if (problemSummary) lines.push(`Problem: ${problemSummary}`);
    if (rootCause) lines.push(`\nRoot Cause: ${rootCause}`);
    if (fixSteps.length > 0) {
      lines.push("\nFix Steps:");
      fixSteps.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
    }
    if (fastChecks.length > 0) {
      lines.push("\nQuick Checks:");
      fastChecks.forEach((c) => lines.push(`  ✓ ${typeof c === "string" ? c : c.text || c}`));
    }
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

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

      {/* ── 🔧 Fix Recipe (HERO section) ── */}
      {hasFixRecipe && (
        <div className="fix-recipe-card">
          <div className="fix-recipe-header">
            <h3>🔧 If You See This Again…</h3>
            <button
              className="copy-recipe-btn"
              onClick={handleCopyRecipe}
              title="Copy fix recipe to clipboard"
            >
              {copied ? "✓ Copied!" : "📋 Copy"}
            </button>
          </div>

          {/* Root Cause */}
          {rootCause && (
            <div className="fix-recipe-cause">
              <span className="fix-recipe-cause-label">🎯 Root Cause</span>
              <p>{rootCause}</p>
            </div>
          )}

          {/* Fix Steps */}
          {fixSteps.length > 0 && (
            <div className="fix-recipe-steps">
              <span className="fix-recipe-section-label">Fix Steps</span>
              <ol className="fix-steps-list">
                {fixSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Quick Checks */}
          {fastChecks.length > 0 && (
            <div className="fix-recipe-checks">
              <span className="fix-recipe-section-label">Quick Checks</span>
              <ul className="fix-checks-list">
                {fastChecks.map((check, i) => (
                  <li key={i}>
                    <span className="check-icon">✓</span>
                    {typeof check === "string" ? check : check.text || check}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── ⚡ Related Situations ── */}
      {relatedSituations.length > 0 && (
        <div className="related-situations">
          <h3>⚡ This Also Applies When…</h3>
          <ul>
            {relatedSituations.map((situation, i) => (
              <li key={i}>
                {typeof situation === "string"
                  ? situation
                  : situation.description || situation.text || situation}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 📊 Stats Dashboard ── */}
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

      {/* ── 🏷️ Topics Covered ── */}
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

      {/* ── 📝 Reflection Prompt ── */}
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
  fixRecipe: PropTypes.shape({
    mostLikelyCause: PropTypes.string,
    fixSteps: PropTypes.array,
    fastChecks: PropTypes.array,
  }),
  microLesson: PropTypes.object,
};
