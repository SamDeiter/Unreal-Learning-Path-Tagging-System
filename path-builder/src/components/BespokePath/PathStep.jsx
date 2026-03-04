/**
 * PathStep — A single step in a bespoke learning path.
 * Renders in the "Epic-style" layout from the mockup.
 *
 * Supports two audio modes:
 * 1. Path Narration (preferred): cohesive script from generatePathNarration
 * 2. Per-step audio (fallback): isolated clip from generateStepAudio
 */

import { useState } from "react";
import { CATEGORY_STYLES } from "./pathConstants";

// ── Helpers ───────────────────────────────────────────────────────────

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

function cleanText(raw) {
  if (!raw) return "";
  let text = String(raw);
  text = text.replace(/^(#{1,6}\s*-?\s*)+/gm, "").trim();
  text = text.replace(/<[^>]+>/g, "");
  text = decodeEntities(text);
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function filterTakeaways(items) {
  if (!items || !items.length) return items;
  return items.filter((t) => {
    const lower = t.toLowerCase().trim();
    if (lower.startsWith("key systems:")) return false;
    if (lower.startsWith("key concepts:")) return false;
    if (lower.length < 15) return false;
    return true;
  });
}

// ── Component ─────────────────────────────────────────────────────────

export default function PathStep({
  step,
  isActive,
  narrationScript,
  stepAudioUrl,
  stepAudioLoading,
  onGenerateAudio,
  narrationLoading,
  onGenerateNarration,
  hasNarration,
  takeaways,
  takeawayLoading,
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  if (!step) return null;
  const { segment, category } = step;

  const displayTitle = decodeEntities(segment.title || segment.videoTitle || "Step Details");

  // Use narration script when available, otherwise fall back to raw segment text
  const displayText = narrationScript || step.summary || cleanText(segment.text);

  const sourceType = segment.type || segment.source || "docs";
  const sourceLabel =
    sourceType === "transcript" ? "Video" : sourceType === "epic_learning" ? "Article" : "Docs";
  const sourceIcon = sourceType === "transcript" ? "fa-video" : "fa-book-open";

  const filteredTakeaways = filterTakeaways(takeaways);

  return (
    <div className={`step-article ${isActive ? "active" : ""}`}>
      {/* Header */}
      <header className="step-header">
        <div className="badge-container">
          <span className={`category-badge category-${category}`}>{category.toUpperCase()}</span>
        </div>
        <h1 className="step-title">{displayTitle}</h1>
      </header>

      {/* Audio Controls */}
      {isActive && (
        <div className="video-progress-container">
          {stepAudioUrl ? (
            /* Dark-themed native audio player */
            <audio controls src={stepAudioUrl} className="dark-audio-player" />
          ) : narrationLoading ? (
            <div className="audio-generating">
              <div className="bespoke-spinner" style={{ width: "18px", height: "18px" }} />
              <span>Generating narration…</span>
            </div>
          ) : stepAudioLoading ? (
            <div className="audio-generating">
              <div className="bespoke-spinner" style={{ width: "18px", height: "18px" }} />
              <span>Generating audio…</span>
            </div>
          ) : !hasNarration ? (
            /* Primary action: generate full path narration */
            <button
              className="generate-narration-btn"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateNarration?.();
              }}
              title="Generate a cohesive narrated walkthrough for the entire path"
            >
              <i className="fa-solid fa-headphones"></i> Generate Narration
            </button>
          ) : (
            /* Fallback: per-step audio if narration exists but this step has no audio */
            <button
              className="play-pause-btn"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateAudio?.();
              }}
              title="Generate audio for this step"
            >
              <i className="fa-solid fa-play"></i>
            </button>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="content-area">
        <div className="sources-pills">
          <span className="source-pill">
            <i className={`fa-solid ${sourceIcon}`}></i> {sourceLabel}
          </span>
          <span className="source-pill">
            <i className="fa-solid fa-tags"></i> {category}
          </span>
          {narrationScript && (
            <span className="source-pill narration-pill">
              <i className="fa-solid fa-headphones"></i> Narrated
            </span>
          )}
        </div>

        <div className="step-body-text">
          <p>{displayText}</p>
        </div>

        {/* Key Takeaways */}
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

        {/* Sources — Collapsible */}
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
