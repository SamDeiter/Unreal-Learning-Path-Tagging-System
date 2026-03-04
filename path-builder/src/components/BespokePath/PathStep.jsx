/**
 * PathStep — A single step in a bespoke learning path.
 * Renders in the "Epic-style" layout from the mockup.
 */

import { useState } from "react";
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

/**
 * Filter out low-quality takeaways like "Key systems: Blueprint"
 */
function filterTakeaways(items) {
  if (!items || !items.length) return items;
  return items.filter((t) => {
    const lower = t.toLowerCase().trim();
    // Filter out stub-style entries
    if (lower.startsWith("key systems:")) return false;
    if (lower.startsWith("key concepts:")) return false;
    if (lower.length < 15) return false; // Too short to be useful
    return true;
  });
}

// ── Component ─────────────────────────────────────────────────────────

export default function PathStep({
  step,
  isActive,
  stepAudioUrl,
  stepAudioLoading,
  onGenerateAudio,
  takeaways,
  takeawayLoading,
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  if (!step) return null; // Guard against undefined step during state transitions
  const { segment, category } = step;

  const displayTitle = decodeEntities(segment.title || segment.videoTitle || "Step Details");
  const displayText = step.summary || cleanText(segment.text);

  // Source type for pills
  const sourceType = segment.type || segment.source || "docs";
  const sourceLabel =
    sourceType === "transcript" ? "Video" : sourceType === "epic_learning" ? "Article" : "Docs";
  const sourceIcon = sourceType === "transcript" ? "fa-video" : "fa-book-open";

  // Filter takeaways for quality
  const filteredTakeaways = filterTakeaways(takeaways);

  return (
    <div className={`step-article ${isActive ? "active" : ""}`}>
      {/* Header with Phase Badge and Title */}
      <header className="step-header">
        <div className="badge-container">
          <span className={`category-badge category-${category}`}>{category.toUpperCase()}</span>
        </div>
        <h1 className="step-title">{displayTitle}</h1>
      </header>

      {/* Audio Track Bar — real audio controls */}
      {isActive && (
        <div className="video-progress-container">
          {stepAudioUrl ? (
            <audio controls src={stepAudioUrl} style={{ width: "100%" }} />
          ) : stepAudioLoading ? (
            <div
              className="audio-generating"
              style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0" }}
            >
              <div className="bespoke-spinner" style={{ width: "18px", height: "18px" }} />
              <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Generating audio…</span>
            </div>
          ) : (
            <button
              className="play-pause-btn"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateAudio?.();
              }}
              title="Generate audio briefing for this step"
            >
              <i className="fa-solid fa-play"></i>
            </button>
          )}
          {!stepAudioUrl && !stepAudioLoading && (
            <>
              <div className="video-progress-bar">
                <div className="progress-fill" style={{ width: "0%" }}></div>
              </div>
              <span className="video-time">Click ▶ to generate</span>
            </>
          )}
        </div>
      )}

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
          ) : filteredTakeaways && filteredTakeaways.length > 0 ? (
            <ul className="takeaways-list">
              {filteredTakeaways.map((t, i) => (
                <li key={i}>{t.charAt(0).toUpperCase() + t.slice(1)}</li>
              ))}
            </ul>
          ) : (
            <p className="no-takeaways">No specific takeaways extracted for this segment.</p>
          )}
        </div>

        {/* Sources / Footnotes Section — Collapsible */}
        <div className="footnotes-section">
          <div
            className="footnotes-header"
            onClick={() => setSourcesOpen(!sourcesOpen)}
            style={{ cursor: "pointer" }}
          >
            <span>Sources</span>
            <i className={`fa-solid ${sourcesOpen ? "fa-chevron-up" : "fa-chevron-down"}`}></i>
          </div>
          {sourcesOpen && (
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
          )}
        </div>
      </div>
    </div>
  );
}
