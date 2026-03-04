/**
 * PathStep — A single step in a bespoke learning path.
 * Renders differently based on source type (transcript, epic_learning, docs).
 */

import { CATEGORY_STYLES } from "./pathConstants";

// ── Helpers ───────────────────────────────────────────────────────────

const MAX_DISPLAY_CHARS = 300;

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
 * Clean raw text that may contain stringified structured data.
 * Epic Learning chunks sometimes store text as stringified lists of
 * paragraph objects like: [{'type': 'paragraph', 'content': '...'}]
 * or separated by ` - ` between dicts.
 */
function cleanText(raw) {
  if (!raw) return "";
  let text = String(raw);

  // Detect stringified Python-style list of dicts
  if (/['"]type['"]\s*:\s*['"]paragraph['"]/.test(text)) {
    // Strategy: split on content key, grab everything after the value opener
    // until the closing quote+brace pattern.  Handles apostrophes inside text.
    const contentParts = [];
    // Split the text at each 'content': or "content": marker
    const splits = text.split(/['"]content['"]\s*:\s*['"]/);
    for (let i = 1; i < splits.length; i++) {
      // Grab text up to the closing pattern: '}] or '} or '] or similar
      // Look for the last quote before a closing brace
      const chunk = splits[i];
      // Find the end: either '} or "} at the end of this content value
      const endMatch = chunk.match(/^([\s\S]*?)(?:['"]\s*\})/);
      if (endMatch && endMatch[1]) {
        contentParts.push(endMatch[1].trim());
      }
    }
    if (contentParts.length > 0) {
      text = contentParts.join(" ");
    }
  }

  // Strip leading "#### -" markdown artifacts and heading markers
  text = text.replace(/^(#{1,6}\s*-?\s*)+/gm, "").trim();
  // Remove ` - ` list separators from concatenated chunks
  text = text.replace(/\s*-\s*\[?\{?\s*$/gm, "").trim();

  // Strip inline HTML tags like <mark>, <code>, etc.
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = decodeEntities(text);

  // Collapse excess whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Truncate with ellipsis
  if (text.length > MAX_DISPLAY_CHARS) {
    text = text.slice(0, MAX_DISPLAY_CHARS).replace(/\s+\S*$/, "") + "…";
  }

  return text;
}

// ── Component ─────────────────────────────────────────────────────────

export default function PathStep({
  step,
  index,
  isActive,
  onClick,
  stepAudioUrl,
  stepAudioLoading,
  onGenerateAudio,
  takeaways,
  takeawayLoading,
}) {
  const { segment, category } = step;
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.foundation;

  const displayTitle = decodeEntities(segment.title || segment.videoTitle || "");
  // Prefer AI-generated summary; fall back to cleaned raw text
  const displayText = step.summary || cleanText(segment.text);
  const hasAuthor = segment.author && segment.author !== "Unknown";
  const similarityPct = Math.round((segment.similarity || 0) * 100);

  const renderSource = () => {
    switch (segment.type) {
      case "transcript":
        return (
          <div className="step-source transcript-source">
            {segment.thumbnailUrl && (
              <a
                href={segment.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="video-thumbnail-link"
              >
                <img
                  src={segment.thumbnailUrl}
                  alt={segment.videoTitle || "Video clip"}
                  className="video-thumbnail"
                />
                <span className="play-overlay">▶</span>
              </a>
            )}
            <div className="source-info">
              <span className="source-title">{decodeEntities(segment.videoTitle)}</span>
              {segment.startTimestamp && (
                <span className="source-timestamp">
                  ⏱ {segment.startTimestamp}
                  {segment.endTimestamp ? ` – ${segment.endTimestamp}` : ""}
                </span>
              )}
              {segment.courseCode && <span className="source-course">📚 {segment.courseCode}</span>}
              {segment.videoUrl && (
                <a
                  href={segment.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link video-link"
                >
                  🎬 Watch this clip →
                </a>
              )}
            </div>
          </div>
        );

      case "epic_learning":
        return (
          <div className="step-source epic-source">
            <span className="source-icon">📖</span>
            <div className="source-info">
              <span className="source-title">{displayTitle}</span>
              {hasAuthor && <span className="source-author">by {segment.author}</span>}
              {segment.url && (
                <a
                  href={segment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link"
                >
                  Open in Epic Dev →
                </a>
              )}
            </div>
          </div>
        );

      case "docs":
        return (
          <div className="step-source docs-source">
            <span className="source-icon">📄</span>
            <div className="source-info">
              <span className="source-title">{displayTitle}</span>
              {segment.section && <span className="source-section">§ {segment.section}</span>}
              {segment.url && (
                <a
                  href={segment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-link"
                >
                  Open Docs →
                </a>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`path-step ${isActive ? "active" : ""} category-${category}`}
      onClick={onClick}
      style={{ "--step-accent": style.color }}
    >
      <div className="step-phase-tag">
        <span className="phase-tag-badge" style={{ background: style.color }}>
          {style.icon} {style.label}
        </span>
      </div>

      {renderSource()}

      <div className="step-text">
        <p>{displayText}</p>
      </div>

      {/* Source Citation Pills */}
      {isActive && segment && (
        <div className="sources-footer">
          <details>
            <summary>
              📎 Sources (
              {segment.type === "transcript"
                ? "Video"
                : segment.type === "epic_learning"
                  ? "Article"
                  : "Docs"}
              )
            </summary>
            <div className="sources-list">
              {segment.type === "transcript" && segment.videoUrl && (
                <a
                  href={segment.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-citation"
                >
                  <span className="source-icon">📹</span>
                  {decodeEntities(segment.videoTitle || "Video Source")}
                  {segment.startTime != null &&
                    ` — ${Math.floor(segment.startTime / 60)}:${String(Math.floor(segment.startTime % 60)).padStart(2, "0")}`}
                </a>
              )}
              {segment.type === "epic_learning" && (
                <a
                  href={segment.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-citation"
                >
                  <span className="source-icon">📖</span>
                  {decodeEntities(segment.title || "Epic Dev Article")}
                </a>
              )}
              {segment.type === "docs" && (
                <a
                  href={segment.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-citation"
                >
                  <span className="source-icon">📄</span>
                  {decodeEntities(segment.title || "Documentation")}
                </a>
              )}
              {hasAuthor && (
                <span className="source-citation">
                  <span className="source-icon">👤</span>
                  {segment.author}
                </span>
              )}
            </div>
          </details>
        </div>
      )}

      {/* Per-step audio + key takeaways (only on active step) */}
      {isActive && (
        <div className="step-extras">
          {/* Key Takeaways */}
          <div className="step-takeaways">
            <h4 className="takeaways-title">🎯 Key Takeaways</h4>
            {takeawayLoading ? (
              <p className="takeaways-loading">Generating takeaways…</p>
            ) : takeaways && takeaways.length > 0 ? (
              <ul className="takeaways-list">
                {takeaways.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Step Audio */}
          <div className="step-audio">
            {stepAudioUrl ? (
              <audio controls src={stepAudioUrl} className="step-audio-player" />
            ) : (
              <button
                className="step-audio-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateAudio?.();
                }}
                disabled={stepAudioLoading}
              >
                {stepAudioLoading ? "⏳ Generating…" : "🔊 Listen to Step Briefing"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
