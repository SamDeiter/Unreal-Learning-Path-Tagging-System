/**
 * PathStep — A single step in a bespoke learning path.
 * Renders in the "Epic-style" layout from the mockup.
 *
 * Supports two audio modes:
 * 1. Path Narration (preferred): cohesive script from generatePathNarration
 * 2. Per-step audio (fallback): isolated clip from generateStepAudio
 */

import { useState, useRef, useEffect } from "react";
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

/**
 * Convert single-quoted or backtick-quoted terms in text to bold elements.
 * Uses word-boundary checks to avoid catching apostrophes in
 * contractions like "isn't", "it's", "don't".
 * e.g. "Adjust 'NetClientTicksPerSecond' in config" →
 *       Adjust <strong>NetClientTicksPerSecond</strong> in config
 * Also handles `BacktickTerms` → <strong>BacktickTerms</strong>
 */
function highlightKeyTerms(text) {
  // Match 'QuotedTerm' (not contractions) OR `BacktickTerm`
  const parts = text.split(/((?<!\w)'[^']{2,}'(?!\w)|`[^`]{2,}`)/g);
  return parts.map((part, i) => {
    if (part && part.startsWith("'") && part.endsWith("'") && part.length > 2) {
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    }
    if (part && part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    }
    return part;
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
  autoPlayAudio,
  onAudioEnded,
  takeaways,
  takeawayLoading,
  deepDive,
  deepDiveLoading,
  onGoDeeper,
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [deepDiveOpen, setDeepDiveOpen] = useState(true);
  const audioRef = useRef(null);

  // Auto-play audio when transitioning between phases
  useEffect(() => {
    if (autoPlayAudio && stepAudioUrl && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [autoPlayAudio, stepAudioUrl]);

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
            /* Dark-themed native audio player — auto-advances on end */
            <audio
              ref={audioRef}
              controls
              src={stepAudioUrl}
              className="dark-audio-player"
              onEnded={onAudioEnded}
            />
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

        {narrationScript ? (
          /* Collapsible narrator script — collapsed by default */
          <div className="narrator-script-toggle">
            <button className="script-toggle-btn" onClick={() => setScriptOpen(!scriptOpen)}>
              <i className={`fa-solid fa-chevron-${scriptOpen ? "up" : "down"}`}></i>
              📝 Narrator Script
            </button>
            {scriptOpen && (
              <div className="step-body-text script-collapsed">
                <p>{displayText}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="step-body-text">
            <p>{displayText}</p>
          </div>
        )}

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
                <li key={i}>{highlightKeyTerms(t.charAt(0).toUpperCase() + t.slice(1))}</li>
              ))}
            </ul>
          ) : (
            <p className="no-takeaways">No specific takeaways extracted for this segment.</p>
          )}
        </div>

        {/* Go Deeper */}
        {isActive && (
          <div className="deepdive-section">
            {deepDive && deepDive.length > 0 ? (
              <>
                <button
                  className="deepdive-toggle-btn"
                  onClick={() => setDeepDiveOpen(!deepDiveOpen)}
                >
                  <i className={`fa-solid fa-chevron-${deepDiveOpen ? "up" : "down"}`}></i>
                  🔍 Deep Dive ({deepDive.length} sections)
                </button>
                {deepDiveOpen && (
                  <div className="deepdive-panels">
                    {deepDive.map((section, i) => (
                      <div key={i} className={`deepdive-panel deepdive-${section.type}`}>
                        <h4 className="deepdive-panel-title">
                          {section.type === "concept"
                            ? "💡"
                            : section.type === "mechanics"
                              ? "⚙️"
                              : "🛠️"}{" "}
                          {section.title}
                        </h4>
                        <div className="deepdive-panel-content">
                          {section.content
                            .split("\n")
                            .filter(Boolean)
                            .map((p, j) => (
                              <p key={j}>{highlightKeyTerms(p)}</p>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : deepDiveLoading ? (
              <div className="deepdive-loading">
                <div className="bespoke-spinner" style={{ width: "18px", height: "18px" }} />
                <span>Generating deeper content…</span>
              </div>
            ) : (
              <button
                className="go-deeper-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onGoDeeper?.();
                }}
              >
                🔍 Go Deeper
              </button>
            )}
          </div>
        )}

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
