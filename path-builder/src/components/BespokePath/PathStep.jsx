/**
 * PathStep — A single step in a bespoke learning path.
 * Renders in the "Epic-style" layout from the mockup.
 *
 * Supports two audio modes:
 * 1. Path Narration (preferred): cohesive script from generatePathNarration
 * 2. Per-step audio (fallback): isolated clip from generateStepAudio
 */

import { useState, useRef, useEffect } from "react";
import { submitStepFeedback } from "../../services/feedbackService";
import { trackAIStepFeedback } from "../../services/analyticsService";
import { cleanVideoTitle } from "../../utils/cleanVideoTitle";
import { CATEGORY_STYLES } from "./pathConstants";
import { fixEpicUrl } from "../../utils/urlHelpers";
import DeepDiveSection from "./DeepDiveSection";

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

/** Strip conference / brand suffixes from video titles — delegates to cleanVideoTitle
 *  for consistent formatting across the app. */
function cleanTitle(raw) {
  if (!raw) return raw;
  return cleanVideoTitle(raw);
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
 * Convert quoted, backtick-quoted, or **markdown bold** terms in text to bold elements.
 * Handles 'single', `backtick`, "double" quoted terms (2+ chars),
 * and **double-asterisk** bold terms.
 * Also auto-detects known UE5 editor terms and highlights them.
 * Uses word-boundary checks to avoid catching apostrophes in
 * contractions like "isn't", "it's", "don't".
 */

// Known UE5 terms to auto-highlight when found in plain text.
// ONLY multi-word or unambiguous terms — single generic words like
// "Actor", "Component", "Character" match inside compound words
// (e.g. "ChaosVehicleMovementComponent") and break text rendering.
const UE_TERMS = [
  "Content Browser",
  "World Outliner",
  "Details Panel",
  "Details panel",
  "Blueprint Editor",
  "Event Graph",
  "Level Editor",
  "Material Editor",
  "Material Instance",
  "World Settings",
  "Play In Editor",
  "Widget Blueprint",
  "Static Mesh",
  "Skeletal Mesh",
  "Animation Blueprint",
  "Anim Blueprint",
  "Behavior Tree",
  "AI Controller",
  "Data Table",
  "Game Instance",
  "Level Blueprint",
  "Construction Script",
  "Begin Play",
  "Event Tick",
  "Post Process",
  "Ray Tracing",
  "Virtual Shadow Maps",
  "World Partition",
  "Data Layers",
  "Content Drawer",
  "Output Log",
  "Message Log",
  "Class Defaults",
  "Class Settings",
  "Unreal Engine",
  "UE5",
  "UE4",
  "Niagara",
  "Nanite",
  "Lumen",
  "MetaHuman",
  "Quixel",
  "Sequencer",
  "NavMesh",
  "EQS",
  "HLOD",
  "Blackboard",
  "PlayerController",
  "GameMode",
];

// Build a single regex with word boundaries so "Component" doesn't match
// inside "ChaosVehicleMovementComponent"
const UE_TERMS_REGEX = new RegExp(
  `\\b(${UE_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "g"
);

function highlightKeyTerms(text) {
  if (typeof text !== "string") return text;
  // First pass: markdown-style patterns (**bold**, 'quoted', `backtick`, "double")
  const parts = text.split(/(\*\*[^*]{2,}\*\*|(?<!\w)'[^']{2,}'(?!\w)|`[^`]{2,}`|"[^"]{2,}")/g);
  return parts.map((part, i) => {
    if (part && part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="ue-term">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part && part.startsWith("'") && part.endsWith("'") && part.length > 2) {
      return (
        <strong key={i} className="ue-term">
          {part.slice(1, -1)}
        </strong>
      );
    }
    if (part && part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <strong key={i} className="ue-term">
          {part.slice(1, -1)}
        </strong>
      );
    }
    if (part && part.startsWith('"') && part.endsWith('"') && part.length > 2) {
      return (
        <strong key={i} className="ue-term">
          {part.slice(1, -1)}
        </strong>
      );
    }
    // Second pass: auto-detect known UE5 terms in remaining plain text
    if (part && UE_TERMS_REGEX.test(part)) {
      // Reset regex lastIndex since we used .test()
      UE_TERMS_REGEX.lastIndex = 0;
      const subParts = part.split(UE_TERMS_REGEX);
      return subParts.map((sub, j) => {
        if (UE_TERMS_REGEX.test(sub)) {
          UE_TERMS_REGEX.lastIndex = 0;
          return (
            <strong key={`${i}-${j}`} className="ue-term">
              {sub}
            </strong>
          );
        }
        return sub;
      });
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
  editorContext,
  onGoDeeper,
  query,
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [sectionRatings, setSectionRatings] = useState({}); // { 0: "good", 2: "bad", takeaways: "positive" }
  const audioRef = useRef(null);

  // Auto-play audio when transitioning between phases
  useEffect(() => {
    if (autoPlayAudio && stepAudioUrl && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [autoPlayAudio, stepAudioUrl]);

  if (!step) return null;
  const { segment, category } = step;

  const displayTitle =
    step.title ||
    cleanTitle(decodeEntities(segment.title || segment.videoTitle || "Step Details")) ||
    "Step Details";

  // Use narration script when available, otherwise fall back to raw segment text
  const displayText = narrationScript || step.summary || cleanText(segment.text);

  const filteredTakeaways = filterTakeaways(takeaways);

  return (
    <div className={`step-article ${isActive ? "active" : ""}`}>
      {/* Header */}
      <header className="step-header">
        <div className="badge-container">
          <span className={`category-badge category-${category}`}>{category.toUpperCase()}</span>
          {/* Trust badge — visual indicator of content verification status */}
          {segment.type !== "ai_generated" ? (
            <span className="trust-badge trust-corpus" title="Matched from course corpus">
              <span className="trust-dot trust-dot-green"></span>
            </span>
          ) : segment.corpusVerified ? (
            <span
              className="trust-badge trust-corpus-verified"
              title={`Matches official content: ${segment.corpusMatch?.videoTitle || ""}`}
            >
              <span className="trust-dot trust-dot-yellow-green"></span> Corpus Match
            </span>
          ) : segment.sources && segment.sources.length > 0 ? (
            <span className="trust-badge trust-grounded" title="Verified via Google Search">
              <span className="trust-dot trust-dot-blue"></span> Grounded
            </span>
          ) : (
            <span className="trust-badge trust-unverified" title="AI-generated, not verified">
              <span className="trust-dot trust-dot-amber"></span> AI
            </span>
          )}
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
        {narrationScript ? (
          /* Collapsible narrator script — collapsed by default */
          <div className="narrator-script-toggle">
            <button className="script-toggle-btn" onClick={() => setScriptOpen(!scriptOpen)}>
              <i className={`fa-solid fa-chevron-${scriptOpen ? "up" : "down"}`}></i>
              📝 Narrator Script
            </button>
            {scriptOpen && (
              <div className="step-body-text script-collapsed">
                <p>{highlightKeyTerms(displayText)}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="step-body-text">
            <p>{highlightKeyTerms(displayText)}</p>
          </div>
        )}

        {/* Key Takeaways */}
        <div className="takeaways-box">
          <h3 className="takeaways-title">Key Takeaways</h3>
          {takeawayLoading ? (
            <div className="takeaway-loading-state">
              <div className="takeaway-loading-label">
                <span className="takeaway-loading-spinner" />
                Generating key takeaways…
              </div>
              <div className="takeaway-skeleton-lines">
                <div className="skeleton-line" style={{ width: "90%" }} />
                <div className="skeleton-line" style={{ width: "75%" }} />
                <div className="skeleton-line" style={{ width: "60%" }} />
              </div>
            </div>
          ) : filteredTakeaways && filteredTakeaways.length > 0 ? (
            <ul className="takeaways-list">
              {filteredTakeaways.map((t, i) => {
                // Normalize ALL CAPS prefix (e.g. "ANIMATION NODE:" → "Animation Node:")
                const normalized = t.replace(
                  /^([A-Z][A-Z\s]+):/,
                  (_, prefix) =>
                    prefix
                      .split(" ")
                      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
                      .join(" ") + ":"
                );
                const final = normalized.charAt(0).toUpperCase() + normalized.slice(1);

                // Split "— success:" onto its own line
                const successMatch = final.match(/^(.*?)\s*—\s*success:\s*(.*)$/i);
                if (successMatch) {
                  const [, main, outcome] = successMatch;
                  return (
                    <li key={i}>
                      {highlightKeyTerms(main)}
                      <div className="takeaway-success">
                        ✅ Success: {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
                      </div>
                    </li>
                  );
                }
                return <li key={i}>{highlightKeyTerms(final)}</li>;
              })}
            </ul>
          ) : (
            <p className="no-takeaways">No specific takeaways extracted for this segment.</p>
          )}
          {/* Step-level feedback */}
          {filteredTakeaways?.length > 0 && (
            <div className="deepdive-rating" style={{ marginTop: "0.5rem" }}>
              {sectionRatings["takeaways"] ? (
                <span className="deepdive-rating-done">
                  {sectionRatings["takeaways"] === "positive" ? "👍" : "👎"} Thanks for the feedback
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="deepdive-rate-btn deepdive-rate-good"
                    onClick={() => {
                      setSectionRatings((prev) => ({ ...prev, takeaways: "positive" }));
                      submitStepFeedback("positive", {
                        stepTitle: step?.segment?.title || "",
                        category: step?.category || "",
                        query: query || "",
                        summary: step?.summary || "",
                      });
                      trackAIStepFeedback(
                        step?.segment?.title || "",
                        step?.category || "",
                        query || "",
                        "positive"
                      );
                    }}
                    title="This step's content was helpful"
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    className="deepdive-rate-btn deepdive-rate-bad"
                    onClick={() => {
                      setSectionRatings((prev) => ({ ...prev, takeaways: "negative" }));
                      submitStepFeedback("negative", {
                        stepTitle: step?.segment?.title || "",
                        category: step?.category || "",
                        query: query || "",
                        summary: step?.summary || "",
                      });
                      trackAIStepFeedback(
                        step?.segment?.title || "",
                        step?.category || "",
                        query || "",
                        "negative"
                      );
                    }}
                    title="This step's content was unhelpful or inaccurate"
                  >
                    👎
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Go Deeper — concept + mechanics only */}
        {isActive && (
          <DeepDiveSection
            deepDive={deepDive}
            deepDiveLoading={deepDiveLoading}
            editorContext={editorContext}
            onGoDeeper={onGoDeeper}
            step={step}
            sectionRatings={sectionRatings}
            onRateSection={(idx, rating) =>
              setSectionRatings((prev) => ({ ...prev, [idx]: rating }))
            }
          />
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
              {/* ── Grounding Sources (from Google Search verification) ── */}
              {segment.sources && segment.sources.length > 0 && (
                <div className="grounding-sources">
                  {segment.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footnote-link grounding-source-link"
                    >
                      <i className="fa-solid fa-link"></i>
                      {src.title || "Verified Source"}
                    </a>
                  ))}
                </div>
              )}
              {/* ── Corpus Verification Match ── */}
              {segment.corpusVerified && segment.corpusMatch && (
                <div className="grounding-sources" style={{ marginBottom: 6 }}>
                  <a
                    href={segment.corpusMatch.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footnote-link grounding-source-link"
                    title={`${(segment.corpusMatch.similarity * 100).toFixed(0)}% match`}
                  >
                    <i className="fa-solid fa-circle-check" style={{ color: "#84cc16" }}></i>
                    Related official content: {segment.corpusMatch.videoTitle}
                  </a>
                </div>
              )}
              {/* ── Unverified AI warning ── */}
              {segment.type === "ai_generated" && segment.unverified && !segment.corpusVerified && (
                <div className="unverified-banner">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  AI-generated — could not verify against external sources
                </div>
              )}
              {(() => {
                // Derive source type & icon locally for the link
                const sourceType = segment.type || segment.source || "docs";
                const sourceIcon =
                  sourceType === "ai_generated"
                    ? "fa-robot"
                    : sourceType === "transcript"
                      ? "fa-video"
                      : "fa-book-open";
                // Determine the best available URL for this source
                const directUrl = segment.videoUrl || segment.url;
                // Use Google site-scoped search (Epic's ?query= URLs 404)
                const fallbackUrl =
                  sourceType === "transcript"
                    ? `https://www.youtube.com/results?search_query=unreal+engine+${encodeURIComponent(displayTitle)}`
                    : `https://www.google.com/search?q=site%3Adev.epicgames.com+${encodeURIComponent(displayTitle)}`;
                const sourceUrl = directUrl || fallbackUrl;

                return sourceType !== "ai_generated" ? (
                  <a
                    href={fixEpicUrl(sourceUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footnote-link"
                  >
                    <i className={`fa-solid ${sourceIcon}`}></i>
                    {displayTitle}
                  </a>
                ) : (
                  <div className="footnote-ai-note">
                    <span className="footnote-ai-label">
                      <i className="fa-solid fa-robot"></i> AI-synthesized from multiple sources
                    </span>
                    <a
                      href={`https://www.google.com/search?q=site%3Adev.epicgames.com+unreal+engine+${encodeURIComponent(displayTitle)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footnote-link footnote-search-link"
                    >
                      <i className="fa-solid fa-magnifying-glass"></i>
                      Search Epic Docs for &quot;{displayTitle}&quot;
                    </a>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
