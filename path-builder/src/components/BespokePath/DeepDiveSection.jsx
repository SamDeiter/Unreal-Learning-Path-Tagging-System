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
import { getFirebaseApp } from "../../services/firebaseConfig";

/** Convert quoted, backtick-quoted, or **markdown bold** terms to bold elements. */
function highlightKeyTerms(text) {
  if (!text || typeof text !== "string") return text;
  // Split by patterns: `backtick`, 'single quotes', "double quotes", **bold**
  const parts = text.split(/(`[^`]+`|'(?=[A-Z])[^']{2,}'|"[^"]{2,}"|(?<!\w)\*\*[^*]+\*\*(?!\w))/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <strong key={i} className="ue-term">
          {part.slice(1, -1)}
        </strong>
      );
    }
    if (part.startsWith("'") && part.endsWith("'") && part.length > 2) {
      return (
        <strong key={i} className="ue-term">
          {part.slice(1, -1)}
        </strong>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="ue-term">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('"') && part.endsWith('"') && part.length > 2) {
      return (
        <strong key={i} className="ue-term">
          {part.slice(1, -1)}
        </strong>
      );
    }
    return part;
  });
}

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
                  <DeepDiveContent section={section} highlightFn={highlightKeyTerms} />
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

/** Renders deep dive section content with appropriate formatting */
function DeepDiveContent({ section, highlightFn }) {
  const lines = section.content
    .split("\n")
    .filter(Boolean)
    .map((l) => l.replace(/— ([a-z])/, (_, c) => "— " + c.toUpperCase()))
    .map((l) => {
      // In properties sections, auto-bold the property name before "—"
      if (section.type === "properties" && l.includes("—")) {
        return l.replace(
          /^(•\s*)?([^—]+?)(\s*—)/,
          (_, bullet, name, dash) => `${bullet || ""}**${name.trim()}**${dash}`
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
          <li key={j}>{highlightFn(l.replace(/^•\s*/, ""))}</li>
        ))}
      </ul>
    );
  }

  if (isNumbered) {
    const groups = [];
    lines.forEach((l) => {
      if (/^\d+[.)]/.test(l.trim())) {
        groups.push({ text: l.replace(/^\d+[.)]\s*/, ""), subs: [] });
      } else if (l.trim().startsWith("•") && groups.length > 0) {
        groups[groups.length - 1].subs.push(l.replace(/^•\s*/, "").trim());
      } else if (groups.length > 0) {
        groups[groups.length - 1].subs.push(l.trim());
      }
    });
    return (
      <ol className="deepdive-steps">
        {groups.map((g, j) => (
          <li key={j}>
            {highlightFn(g.text)}
            {g.subs.length > 0 && (
              <ul className="deepdive-sub-bullets">
                {g.subs.map((s, k) => (
                  <li key={k}>{highlightFn(s)}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    );
  }

  return lines.map((p, j) => <p key={j}>{highlightFn(p)}</p>);
}
