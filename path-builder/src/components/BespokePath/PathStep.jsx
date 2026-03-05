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

/** Strip conference / brand suffixes from video titles.
 *  e.g. "Refactoring the Mesh Drawing Pipeline | Unreal Fest Europe 2019 | Unreal Engine"
 *  becomes "Refactoring the Mesh Drawing Pipeline" */
function cleanTitle(raw) {
  if (!raw) return raw;
  let t = String(raw);
  // If the title is just a raw YouTube ID, return null so caller uses fallback
  if (/^YouTube:\s*[A-Za-z0-9_-]{8,15}$/i.test(t.trim())) return null;
  // Strip trailing pipe-delimited suffixes like "| Unreal Fest...", "| Unreal Engine", "| Epic Games"
  t = t.replace(
    /\s*\|\s*(Unreal\s+(Fest|Engine|Summit)|Epic\s+Games|GDC|Inside\s+Unreal)[^|]*/gi,
    ""
  );
  return t.trim();
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
 * Convert quoted or backtick-quoted terms in text to bold elements.
 * Handles 'single', `backtick`, and "double" quoted terms (2+ chars).
 * Uses word-boundary checks to avoid catching apostrophes in
 * contractions like "isn't", "it's", "don't".
 */
function highlightKeyTerms(text) {
  if (typeof text !== "string") return text;
  // Match 'QuotedTerm' (not contractions) OR `BacktickTerm` OR "DoubleQuoted"
  const parts = text.split(/((?<!\w)'[^']{2,}'(?!\w)|`[^`]{2,}`|"[^"]{2,}")/g);
  return parts.map((part, i) => {
    if (part && part.startsWith("'") && part.endsWith("'") && part.length > 2) {
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    }
    if (part && part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    }
    if (part && part.startsWith('"') && part.endsWith('"') && part.length > 2) {
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
  editorContext,
  onGoDeeper,
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [deepDiveOpen, setDeepDiveOpen] = useState(true);
  const [sectionRatings, setSectionRatings] = useState({}); // { 0: "good", 2: "bad" }
  const audioRef = useRef(null);

  // Save deepdive section rating to Firestore
  const rateSection = useCallback(
    async (sectionIndex, rating) => {
      const section = deepDive?.[sectionIndex];
      if (!section) return;
      setSectionRatings((prev) => ({ ...prev, [sectionIndex]: rating }));
      try {
        const db = getFirestore();
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
                  {editorContext && <span className="editor-context-badge">{editorContext}</span>}
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
                          {(() => {
                            const lines = section.content.split("\n").filter(Boolean);
                            const isBullets = lines.some((l) => l.trim().startsWith("•"));
                            const isNumbered = lines.some((l) => /^\d+[.)]/.test(l.trim()));

                            // For practical sections, always try numbered format first
                            if (section.type === "practical" && (isNumbered || isBullets)) {
                              // If AI returned bullets instead of numbers, convert top-level bullets to numbered
                              const normalized = isNumbered
                                ? lines
                                : lines.map((l, idx) => {
                                    const trimmed = l.trim();
                                    if (trimmed.startsWith("•")) {
                                      // Check if this looks like a sub-bullet (preceded by a numbered/bullet step)
                                      const prevIsStep =
                                        idx > 0 &&
                                        (/^\d+[.)]/.test(lines[idx - 1].trim()) ||
                                          (idx > 0 && !lines[idx - 1].trim().startsWith("•")));
                                      if (
                                        l.startsWith("  ") ||
                                        l.startsWith("\t") ||
                                        prevIsStep === false
                                      ) {
                                        return l; // keep as sub-bullet
                                      }
                                    }
                                    return l;
                                  });

                              const groups = [];
                              normalized.forEach((l) => {
                                const trimmed = l.trim();
                                if (/^\d+[.)]/.test(trimmed)) {
                                  groups.push({
                                    text: trimmed.replace(/^\d+[.)]\s*/, ""),
                                    subs: [],
                                  });
                                } else if (trimmed.startsWith("•") && groups.length > 0) {
                                  groups[groups.length - 1].subs.push(trimmed.replace(/^•\s*/, ""));
                                } else if (trimmed.startsWith("•") && groups.length === 0) {
                                  // Top-level bullet with no prior number — treat as numbered step
                                  groups.push({ text: trimmed.replace(/^•\s*/, ""), subs: [] });
                                } else if (groups.length > 0) {
                                  groups[groups.length - 1].subs.push(trimmed);
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

                            if (isBullets) {
                              return (
                                <ul className="deepdive-bullets">
                                  {lines.map((l, j) => (
                                    <li key={j}>{highlightKeyTerms(l.replace(/^•\s*/, ""))}</li>
                                  ))}
                                </ul>
                              );
                            }
                            if (isNumbered) {
                              // Group: numbered steps with optional sub-bullets
                              const groups = [];
                              lines.forEach((l) => {
                                if (/^\d+[.)]/.test(l.trim())) {
                                  groups.push({ text: l.replace(/^\d+[.)]\s*/, ""), subs: [] });
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
                            return lines.map((p, j) => <p key={j}>{highlightKeyTerms(p)}</p>);
                          })()}
                        </div>
                        {/* Rating buttons */}
                        <div className="deepdive-rating">
                          {sectionRatings[i] ? (
                            <span className="deepdive-rating-done">
                              {sectionRatings[i] === "good" ? "👍" : "👎"} Rated
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="deepdive-rate-btn deepdive-rate-good"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  rateSection(i, "good");
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
                                  rateSection(i, "bad");
                                }}
                                title="This section is vague or off-topic"
                              >
                                👎
                              </button>
                            </>
                          )}
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
              {segment.videoUrl || segment.url ? (
                <a
                  href={fixEpicUrl(segment.videoUrl || segment.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footnote-link"
                >
                  <i className={`fa-solid ${sourceIcon}`}></i>
                  {displayTitle}
                </a>
              ) : (
                <span className="footnote-link footnote-no-link">
                  <i className={`fa-solid ${sourceIcon}`}></i>
                  {displayTitle}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
