/**
 * MicroLesson - RAG-grounded Quick Fix / Why / Related response card
 *
 * Renders structured micro-lesson output from the queryLearningPath CF
 * with clickable video timestamp citations and Epic docs links.
 */
import { useState } from "react";
import "./MicroLesson.css";

/**
 * Format a timestamp string (e.g. "00:12:34" or "12:34") into a clickable display.
 */
function formatTimestamp(ts) {
  if (!ts) return null;
  // Remove leading "00:" for brevity
  return ts.replace(/^00:/, "");
}

export default function MicroLesson({ microLesson, retrievedPassages, videoResults = [] }) {
  const [expandedSection, setExpandedSection] = useState("quick_fix");

  if (!microLesson) return null;

  const { quick_fix, why_it_works, related_situations } = microLesson;

  const toggleSection = (section) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  /**
   * Find a matching video card from videoResults based on citation videoTitle.
   * Uses fuzzy matching (checks if videoTitle is contained in the video's title).
   */
  const findMatchingVideo = (citation) => {
    if (!citation?.videoTitle || videoResults.length === 0) return null;
    const citTitle = citation.videoTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
    return videoResults.find((v) => {
      const vTitle = (v.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return vTitle.includes(citTitle) || citTitle.includes(vTitle);
    });
  };

  /**
   * Scroll to and briefly highlight a video card in the grid above.
   */
  const scrollToVideo = (video) => {
    if (!video) return;
    const el = document.getElementById(`video-${video.driveId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight-flash");
      setTimeout(() => el.classList.remove("highlight-flash"), 1500);
    }
  };

  /**
   * Render a citation chip that links to a specific video moment.
   * Clicking scrolls to the matching video card above.
   */
  const renderCitation = (citation) => {
    if (!citation) return null;
    const label = citation.videoTitle
      ? `${citation.videoTitle} @ ${formatTimestamp(citation.timestamp) || "start"}`
      : `Source [${citation.ref}]`;

    const matchedVideo = findMatchingVideo(citation);
    const isClickable = !!matchedVideo;

    return (
      <span
        key={`${citation.ref}-${citation.timestamp}`}
        className={`ml-citation ${isClickable ? "ml-citation-linked" : ""}`}
        title={isClickable ? `Jump to ${label} ↑` : label}
        onClick={isClickable ? () => scrollToVideo(matchedVideo) : undefined}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
      >
        <span className="ml-citation-icon">🎬</span>
        <span className="ml-citation-text">{label}</span>
        {isClickable && <span className="ml-citation-link-icon">↑</span>}
      </span>
    );
  };

  /**
   * Render doc passage chips from retrievedPassages (source: "epic_docs").
   */
  const renderDocLinks = () => {
    if (!retrievedPassages) return null;
    const docPassages = retrievedPassages.filter((p) => p.source === "epic_docs");
    if (docPassages.length === 0) return null;

    return (
      <div className="ml-doc-links">
        <span className="ml-doc-links-label">📚 Related Documentation</span>
        <div className="ml-doc-chips">
          {docPassages.map((doc, i) => (
            <a
              key={i}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-doc-chip"
              title={doc.text?.slice(0, 200)}
            >
              <span className="ml-doc-chip-icon">📄</span>
              <span className="ml-doc-chip-title">{doc.title || doc.section || "UE5 Docs"}</span>
              {doc.similarity && (
                <span className="ml-doc-chip-score">{Math.round(doc.similarity * 100)}%</span>
              )}
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="micro-lesson">
      <div className="ml-header">
        <div className="ml-header-badge">
          <span className="ml-badge-icon">✨</span>
          <span className="ml-badge-text">AI Micro-Lesson</span>
        </div>
        <span className="ml-header-subtitle">
          Grounded in real course transcripts &amp; documentation
        </span>
      </div>

      {/* ⚡ Quick Fix */}
      {quick_fix && (
        <div
          className={`ml-section ml-quick-fix ${expandedSection === "quick_fix" ? "expanded" : ""}`}
        >
          <button
            className="ml-section-toggle"
            onClick={() => toggleSection("quick_fix")}
            aria-expanded={expandedSection === "quick_fix"}
          >
            <span className="ml-section-icon">⚡</span>
            <span className="ml-section-title">{quick_fix.title || "Quick Fix"}</span>
            <span className="ml-section-tag">~2 min</span>
            <span className="ml-section-chevron">
              {expandedSection === "quick_fix" ? "▾" : "▸"}
            </span>
          </button>

          {expandedSection === "quick_fix" && (
            <div className="ml-section-body">
              {quick_fix.steps && quick_fix.steps.length > 0 && (
                <ol className="ml-steps">
                  {quick_fix.steps.map((step, i) => (
                    <li key={i} className="ml-step">
                      <span className="ml-step-number">{i + 1}</span>
                      <span className="ml-step-text">{step}</span>
                    </li>
                  ))}
                </ol>
              )}

              {quick_fix.citations && quick_fix.citations.length > 0 && (
                <div className="ml-citations">
                  <span className="ml-citations-label">Sources:</span>
                  {quick_fix.citations.map((c) => renderCitation(c))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🧠 Why This Works */}
      {why_it_works && (
        <div className={`ml-section ml-why ${expandedSection === "why" ? "expanded" : ""}`}>
          <button
            className="ml-section-toggle"
            onClick={() => toggleSection("why")}
            aria-expanded={expandedSection === "why"}
          >
            <span className="ml-section-icon">🧠</span>
            <span className="ml-section-title">Why This Works</span>
            {why_it_works.key_concept && (
              <span className="ml-section-concept">{why_it_works.key_concept}</span>
            )}
            <span className="ml-section-chevron">{expandedSection === "why" ? "▾" : "▸"}</span>
          </button>

          {expandedSection === "why" && (
            <div className="ml-section-body">
              <p className="ml-explanation">{why_it_works.explanation}</p>

              {why_it_works.citations && why_it_works.citations.length > 0 && (
                <div className="ml-citations">
                  <span className="ml-citations-label">Sources:</span>
                  {why_it_works.citations.map((c) => renderCitation(c))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🔗 Related Situations */}
      {related_situations && related_situations.length > 0 && (
        <div className={`ml-section ml-related ${expandedSection === "related" ? "expanded" : ""}`}>
          <button
            className="ml-section-toggle"
            onClick={() => toggleSection("related")}
            aria-expanded={expandedSection === "related"}
          >
            <span className="ml-section-icon">🔗</span>
            <span className="ml-section-title">Related Situations</span>
            <span className="ml-section-tag">{related_situations.length} scenarios</span>
            <span className="ml-section-chevron">{expandedSection === "related" ? "▾" : "▸"}</span>
          </button>

          {expandedSection === "related" && (
            <div className="ml-section-body">
              <div className="ml-scenarios">
                {related_situations.map((sit, i) => (
                  <div key={i} className="ml-scenario">
                    <div className="ml-scenario-header">
                      <span className="ml-scenario-icon">💡</span>
                      <span className="ml-scenario-title">{sit.scenario}</span>
                    </div>
                    <p className="ml-scenario-connection">{sit.connection}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 📚 Epic Docs Links */}
      {renderDocLinks()}
    </div>
  );
}
