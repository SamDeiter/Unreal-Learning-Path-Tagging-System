/**
 * PathStep — A single step in a bespoke learning path.
 * Renders in the "Epic-style" layout from the mockup.
 *
 * Supports two audio modes:
 * 1. Path Narration (preferred): cohesive script from generatePathNarration
 * 2. Per-step audio (fallback): isolated clip from generateStepAudio
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseApp } from "../../services/firebaseConfig";
import { submitStepFeedback } from "../../services/feedbackService";
import { cleanVideoTitle } from "../../utils/cleanVideoTitle";
import { CATEGORY_STYLES } from "./pathConstants";

// ── Helpers ───────────────────────────────────────────────────────────

/** Normalize known broken Epic Learning URL patterns */
function fixEpicUrl(url) {
  if (!url) return url;
  return url
    .replace("/learning/tutorial/", "/learning/tutorials/")
    .replace("/learning/knowledge_base/", "/learning/knowledge-base/")
    .replace("/learning/course/", "/learning/courses/")
    .replace("/learning/talks_and_demos/", "/learning/talks-and-demos/");
}

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

// Known UE5 terms to auto-highlight when found in plain text
const UE_TERMS = [
  "Content Browser",
  "World Outliner",
  "Details Panel",
  "Details panel",
  "Blueprint",
  "Blueprints",
  "Blueprint Editor",
  "Event Graph",
  "Level Editor",
  "Material Editor",
  "Material Instance",
  "Viewport",
  "World Settings",
  "Play In Editor",
  "PIE",
  "Actor",
  "Component",
  "Pawn",
  "Character",
  "GameMode",
  "PlayerController",
  "Widget Blueprint",
  "UMG",
  "Sequencer",
  "Niagara",
  "Nanite",
  "Lumen",
  "MetaHuman",
  "Quixel",
  "Landscape",
  "Foliage",
  "Static Mesh",
  "Skeletal Mesh",
  "Animation Blueprint",
  "Anim Blueprint",
  "Behavior Tree",
  "Blackboard",
  "EQS",
  "NavMesh",
  "AI Controller",
  "Data Table",
  "Struct",
  "Enum",
  "Game Instance",
  "Level Blueprint",
  "Construction Script",
  "Begin Play",
  "Event Tick",
  "Collision",
  "Physics",
  "Post Process",
  "Ray Tracing",
  "Virtual Shadow Maps",
  "World Partition",
  "Data Layers",
  "HLOD",
  "C\\+\\+",
  "Unreal Engine",
  "UE5",
  "UE4",
  "Content Drawer",
  "Output Log",
  "Message Log",
  "Class Defaults",
  "Class Settings",
];

// Build a single regex that matches any of these terms (case-insensitive word boundaries)
const UE_TERMS_REGEX = new RegExp(
  `(${UE_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
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
  const [deepDiveOpen, setDeepDiveOpen] = useState(true);
  const [sectionRatings, setSectionRatings] = useState({}); // { 0: "good", 2: "bad" }
  const [stepRating, setStepRating] = useState(null); // "positive" | "negative"
  const audioRef = useRef(null);

  // Save deepdive section rating to Firestore
  const rateSection = useCallback(
    async (sectionIndex, rating) => {
      const section = deepDive?.[sectionIndex];
      if (!section) return;
      setSectionRatings((prev) => ({ ...prev, [sectionIndex]: rating }));
      try {
        const db = getFirestore(getFirebaseApp());
        await addDoc(collection(db, "deepdive_ratings"), {
          stepTitle: step?.segment?.title || "",
          sectionType: section.type,
          sectionTitle: section.title,
          sectionContent: section.content,
          rating, // "good" or "bad"
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to save rating:", err);
      }
    },
    [deepDive, step]
  );

  // Auto-play audio when transitioning between phases
  useEffect(() => {
    if (autoPlayAudio && stepAudioUrl && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [autoPlayAudio, stepAudioUrl]);

  if (!step) return null;
  const { segment, category } = step;

  const displayTitle =
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
            <div className="loading-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
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
              {stepRating ? (
                <span className="deepdive-rating-done">
                  {stepRating === "positive" ? "👍" : "👎"} Thanks for the feedback
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="deepdive-rate-btn deepdive-rate-good"
                    onClick={() => {
                      setStepRating("positive");
                      submitStepFeedback("positive", {
                        stepTitle: step?.segment?.title || "",
                        category: step?.category || "",
                        query: query || "",
                        summary: step?.summary || "",
                      });
                    }}
                    title="This step's content was helpful"
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    className="deepdive-rate-btn deepdive-rate-bad"
                    onClick={() => {
                      setStepRating("negative");
                      submitStepFeedback("negative", {
                        stepTitle: step?.segment?.title || "",
                        category: step?.category || "",
                        query: query || "",
                        summary: step?.summary || "",
                      });
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
        {isActive &&
          (() => {
            const conceptSections = deepDive?.filter((s) => s.type !== "practical") || [];

            return (
              <>
                <div className="deepdive-section">
                  {conceptSections.length > 0 ? (
                    <>
                      <button
                        className="deepdive-toggle-btn"
                        onClick={() => setDeepDiveOpen(!deepDiveOpen)}
                      >
                        <i className={`fa-solid fa-chevron-${deepDiveOpen ? "up" : "down"}`}></i>
                        🔍 Deep Dive ({conceptSections.length} sections)
                        {editorContext && (
                          <span className="editor-context-badge">{editorContext}</span>
                        )}
                      </button>
                      {deepDiveOpen && (
                        <div className="deepdive-panels">
                          {conceptSections.map((section, i) => {
                            const origIdx = deepDive.indexOf(section);
                            return (
                              <div key={i} className={`deepdive-panel deepdive-${section.type}`}>
                                <h4 className="deepdive-panel-title">
                                  {section.type === "properties"
                                    ? "🔧"
                                    : section.type === "pitfalls"
                                      ? "⚠️"
                                      : section.type === "tryit"
                                        ? "🎯"
                                        : section.type === "concept"
                                          ? "💡"
                                          : "⚙️"}{" "}
                                  {section.title}
                                </h4>
                                <div className="deepdive-panel-content">
                                  {(() => {
                                    const lines = section.content
                                      .split("\n")
                                      .filter(Boolean)
                                      .map((l) =>
                                        l.replace(/— ([a-z])/, (_, c) => "— " + c.toUpperCase())
                                      )
                                      .map((l) => {
                                        // In properties sections, auto-bold the property name before "—"
                                        if (section.type === "properties" && l.includes("—")) {
                                          return l.replace(
                                            /^(•\s*)?([^—]+?)(\s*—)/,
                                            (_, bullet, name, dash) =>
                                              `${bullet || ""}**${name.trim()}**${dash}`
                                          );
                                        }
                                        return l;
                                      });
                                    const isBullets = lines.some((l) => l.trim().startsWith("•"));
                                    const isNumbered = lines.some((l) => /^\d+[.)]/.test(l.trim()));

                                    if (isBullets) {
                                      return (
                                        <ul className="deepdive-bullets">
                                          {lines.map((l, j) => (
                                            <li key={j}>
                                              {highlightKeyTerms(l.replace(/^•\s*/, ""))}
                                            </li>
                                          ))}
                                        </ul>
                                      );
                                    }
                                    if (isNumbered) {
                                      const groups = [];
                                      lines.forEach((l) => {
                                        if (/^\d+[.)]/.test(l.trim())) {
                                          groups.push({
                                            text: l.replace(/^\d+[.)]\s*/, ""),
                                            subs: [],
                                          });
                                        } else if (l.trim().startsWith("•") && groups.length > 0) {
                                          groups[groups.length - 1].subs.push(
                                            l.replace(/^•\s*/, "").trim()
                                          );
                                        } else if (groups.length > 0) {
                                          groups[groups.length - 1].subs.push(l.trim());
                                        }
                                      });
                                      return (
                                        <ol className="deepdive-steps">
                                          {groups.map((g, j) => (
                                            <li key={j}>
                                              {highlightKeyTerms(g.text)}
                                              {g.subs.length > 0 && (
                                                <ul className="deepdive-sub-bullets">
                                                  {g.subs.map((s, k) => (
                                                    <li key={k}>{highlightKeyTerms(s)}</li>
                                                  ))}
                                                </ul>
                                              )}
                                            </li>
                                          ))}
                                        </ol>
                                      );
                                    }
                                    return lines.map((p, j) => (
                                      <p key={j}>{highlightKeyTerms(p)}</p>
                                    ));
                                  })()}
                                </div>
                                {/* Rating buttons */}
                                <div className="deepdive-rating">
                                  {sectionRatings[origIdx] ? (
                                    <span className="deepdive-rating-done">
                                      {sectionRatings[origIdx] === "good" ? "👍" : "👎"} Rated
                                    </span>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="deepdive-rate-btn deepdive-rate-good"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          rateSection(origIdx, "good");
                                        }}
                                        title="This section is helpful and specific"
                                      >
                                        👍
                                      </button>
                                      <button
                                        type="button"
                                        className="deepdive-rate-btn deepdive-rate-bad"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          rateSection(origIdx, "bad");
                                        }}
                                        title="This section is vague or off-topic"
                                      >
                                        👎
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : deepDiveLoading ? (
                    <div className="deepdive-loading">
                      <div className="bespoke-spinner" style={{ width: "18px", height: "18px" }} />
                      <span>Generating deeper content…</span>
                    </div>
                  ) : !deepDive || deepDive.length === 0 ? (
                    <button
                      className="go-deeper-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGoDeeper?.();
                      }}
                    >
                      <i className="fa-solid fa-layer-group"></i> Go Deeper
                    </button>
                  ) : null}
                </div>

                {/* Apply It section removed — now lives in standalone sidebar section */}
              </>
            );
          })()}

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
              {/* ── Unverified AI warning ── */}
              {segment.type === "ai_generated" && segment.unverified && (
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
