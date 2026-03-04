/**
 * PathStep — A single step in a bespoke learning path.
 * Renders in the "Epic-style" layout from the mockup.
 */

import { CATEGORY_STYLES } from "./pathConstants";

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Decode common HTML entities in titles/text.
 */
function decodeEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/**
 * Clean raw text from stringified JSON if needed.
 */
function cleanText(raw) {
  if (!raw) return "";
  let text = String(raw);

  // Strip leading "#### -" markdown artifacts
  text = text.replace(/^(#{1,6}\s*-?\s*)+/gm, "").trim();
  // Strip inline HTML tags
  text = text.replace(/<[^>]+>/g, "");
  // Decode HTML entities
  text = decodeEntities(text);
  // Collapse excess whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

// ── Component ─────────────────────────────────────────────────────────

export default function PathStep({ step, isActive, takeaways, takeawayLoading }) {
  if (!step) return null; // Guard against undefined step during state transitions
  const { segment, category } = step;

  const displayTitle = decodeEntities(segment.title || segment.videoTitle || "Step Details");
  const displayText = step.summary || cleanText(segment.text);

  // Source type for pills
  const sourceType = segment.type || segment.source || "docs";
  const sourceLabel =
    sourceType === "transcript" ? "Video" : sourceType === "epic_learning" ? "Article" : "Docs";
  const sourceIcon = sourceType === "transcript" ? "fa-video" : "fa-book-open";

  return (
    <div className={`step-article ${isActive ? "active" : ""}`}>
      {/* Header with Phase Badge and Title */}
      <header className="step-header">
        <div className="badge-container">
          <span className={`category-badge category-${category}`}>{category.toUpperCase()}</span>
        </div>
        <h1 className="step-title">{displayTitle}</h1>
      </header>

      {/* Video Progress / Control Bar (Mockup Style) */}
      <div className="video-progress-container">
        <button className="play-pause-btn">
          <i className="fa-solid fa-play"></i>
        </button>
        <div className="video-progress-bar">
          <div className="progress-fill" style={{ width: "35%" }}></div>
        </div>
        <span className="video-time">02:45 / 08:30</span>
      </div>

      {/* Main Content Area */}
      <div className="content-area">
        <div className="sources-pills">
          <span className="source-pill">
            <i className={`fa-solid ${sourceIcon}`}></i> {sourceLabel}
          </span>
          <span className="source-pill">
            <i className="fa-solid fa-tags"></i> {category}
          </span>
        </div>

        <div className="step-body-text">
          <p>{displayText}</p>
        </div>

        {/* Key Takeaways Box */}
        <div className="takeaways-box">
          <h3 className="takeaways-title">Key Takeaways</h3>
          {takeawayLoading ? (
            <div className="loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </div>
          ) : takeaways && takeaways.length > 0 ? (
            <ul className="takeaways-list">
              {takeaways.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          ) : (
            <p className="no-takeaways">No specific takeaways extracted for this segment.</p>
          )}
        </div>

        {/* Sources / Footnotes Section */}
        <div className="footnotes-section">
          <div className="footnotes-header">
            <span>Sources</span>
            <i className="fa-solid fa-chevron-down"></i>
          </div>
          <div className="footnotes-content">
            <a
              href={segment.videoUrl || segment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="footnote-link"
            >
              <i className={`fa-solid ${sourceIcon}`}></i>
              {displayTitle}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
