/**
 * DeepDiveSection — Renders the expandable "Go Deeper" enrichment panels.
 *
 * Shows concept, properties, pitfalls, and tryit sections with
 * collapsible panels, content formatting (bullets/numbered lists),
 * and per-section rating buttons that write to Firestore.
 *
 * Extracted from PathStep.jsx to reduce its size and
 * isolate the deep dive rendering logic.
 */

import { useState, useCallback } from "react";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getFirebaseApp } from "../../services/firebaseConfig";

/** Section type → emoji icon mapping */
const SECTION_ICONS = {
  properties: "🔧",
  pitfalls: "⚠️",
  tryit: "🎯",
  concept: "💡",
};

export default function DeepDiveSection({
  deepDive,
  deepDiveLoading,
  editorContext,
  onGoDeeper,
  step,
  sectionRatings,
  onRateSection,
}) {
  const [isOpen, setIsOpen] = useState(true);

  // Save deepdive section rating to Firestore
  const rateSection = useCallback(
    async (sectionIndex, rating) => {
      const section = deepDive?.[sectionIndex];
      if (!section) return;
      onRateSection(sectionIndex, rating);
      try {
        const db = getFirestore(getFirebaseApp());
        await addDoc(collection(db, "deepdive_ratings"), {
          stepTitle: step?.segment?.title || "",
          sectionType: section.type,
          sectionTitle: section.title,
          sectionContent: section.content,
          rating,
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.error("Failed to save rating:", err);
      }
    },
    [deepDive, step, onRateSection]
  );

  const conceptSections = deepDive?.filter((s) => s.type !== "practical") || [];

  // No deep dive data and not loading — show "Go Deeper" button
  if (!deepDive || deepDive.length === 0) {
    if (deepDiveLoading) {
      return (
        <div className="deepdive-section">
          <div className="deepdive-loading">
            <div className="bespoke-spinner" style={{ width: "18px", height: "18px" }} />
            <span>Generating deeper content…</span>
          </div>
        </div>
      );
    }
    return (
      <div className="deepdive-section">
        <button
          className="go-deeper-btn"
          onClick={(e) => {
            e.stopPropagation();
            onGoDeeper?.();
          }}
        >
          <i className="fa-solid fa-layer-group"></i> Go Deeper
        </button>
      </div>
    );
  }

  // Has deep dive sections — render panels
  if (conceptSections.length === 0) return null;

  return (
    <div className="deepdive-section">
      <button className="deepdive-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        <i className={`fa-solid fa-chevron-${isOpen ? "up" : "down"}`}></i>
        🔍 Deep Dive ({conceptSections.length} sections)
        {editorContext && <span className="editor-context-badge">{editorContext}</span>}
      </button>
      {isOpen && (
        <div className="deepdive-panels">
          {conceptSections.map((section, i) => {
            const origIdx = deepDive.indexOf(section);
            const icon = SECTION_ICONS[section.type] || "⚙️";
            return (
              <div key={i} className={`deepdive-panel deepdive-${section.type}`}>
                <h4 className="deepdive-panel-title">
                  {icon} {section.title}
                </h4>
                <div className="deepdive-panel-content">
                  <DeepDiveContent section={section} />
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
    </div>
  );
}

/**
 * Renders deep-dive section content as markdown (GFM).
 *
 * Gemini returns content with `##` headings, `-` bullets, numbered lists,
 * **bold**, and occasional `code` spans. The old hand-rolled parser only
 * understood `•` bullets and dumped everything else as literal text.
 * ReactMarkdown + remark-gfm handles all of that; component overrides
 * scope the styling to the existing .deepdive-* CSS namespace.
 *
 * For properties sections we still want the old "Name — description"
 * auto-bold, so we pre-process those lines before handing to ReactMarkdown.
 */
function DeepDiveContent({ section }) {
  const content =
    section.type === "properties"
      ? section.content
          .split("\n")
          .map((l) =>
            l.includes("—")
              ? l.replace(
                  /^([-•*]\s*)?([^—]+?)(\s*—)/,
                  (_, bullet, name, dash) => `${bullet || ""}**${name.trim()}**${dash}`
                )
              : l
          )
          .join("\n")
      : section.content;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Force any heading level to the same visual weight inside the panel
        // (the panel already has its own title above, so nested h1/h2 would
        // fight it). Wrap in a bolded paragraph for a consistent look.
        h1: ({ children }) => <p className="deepdive-heading">{children}</p>,
        h2: ({ children }) => <p className="deepdive-heading">{children}</p>,
        h3: ({ children }) => <p className="deepdive-heading">{children}</p>,
        h4: ({ children }) => <p className="deepdive-heading">{children}</p>,
        ul: ({ children }) => <ul className="deepdive-bullets">{children}</ul>,
        ol: ({ children }) => <ol className="deepdive-steps">{children}</ol>,
        strong: ({ children }) => <strong className="ue-term">{children}</strong>,
        code: ({ inline, children }) =>
          inline ? (
            <code className="ue-term">{children}</code>
          ) : (
            <pre className="deepdive-code">
              <code>{children}</code>
            </pre>
          ),
        // Safe link rendering — always new-tab + rel
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
