import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { PlayCircle, Check, Plus, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { recordUpvote, recordDownvote, getFeedbackStatus } from "../../services/feedbackService";
import prereqData from "../../data/course_prerequisites.json";
import libraryData from "../../data/video_library_enriched.json";
import "./VideoResultCard.css";

// Build code→title and code→versions lookups once
const courseTitles = {};
const courseVersions = {};
(libraryData.courses || []).forEach((c) => {
  courseTitles[c.code] = c.title;
  courseVersions[c.code] = c.versions || [];
});

/** Returns true if ALL course versions are 4.x (UE4 era) */
function isUE4Course(code) {
  const versions = courseVersions[code];
  if (!versions || versions.length === 0) return false;
  return versions.every((v) => {
    const normalized = String(v).replace(/^V/i, "");
    return normalized.startsWith("4") && !normalized.startsWith("4.") ? /^4\d{1,2}$/.test(normalized) : normalized.startsWith("4.");
  });
}

/**
 * Formats seconds into a human-readable duration string.
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 1) return "<1 min";
  return `${mins} min`;
}

/**
 * Individual video result card — compact by default, expandable on click.
 * When expanded, shows MicroLesson content, timestamps, course details.
 */
export default function VideoResultCard({
  video,
  isAdded,
  onToggle,
  userQuery,
  isExpanded = false,
  onExpand,
  microLesson,
  retrievedPassages,
}) {
  const {
    title: rawTitle,
    courseName,
    duration,
    matchedTags = [],
    driveId,
    topSegments = [],
    courseCode,
    _curatedMatch,
    role,
    reason,
  } = video;

  // Strip "Part A/B/C" suffixes from display title
  const title = rawTitle?.replace(/\s+Part\s+[A-Z]$/i, "").trim() || rawTitle;
  // Look up prereq data for this course
  const prereqEntry = courseCode ? prereqData[courseCode] : null;
  const prereqCourses = prereqEntry?.prereqs || [];

  const [feedbackState, setFeedbackState] = useState(() => getFeedbackStatus(driveId));
  const [prereqTip, setPrereqTip] = useState(false);
  const [expandedLesson, setExpandedLesson] = useState("quick_fix");
  const tipRef = useRef(null);

  // Scroll expanded card into view
  const cardRef = useRef(null);
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      setTimeout(() => {
        cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    }
  }, [isExpanded]);

  // Close tooltip on outside click
  useEffect(() => {
    if (!prereqTip) return;
    const handler = (e) => {
      if (tipRef.current && !tipRef.current.contains(e.target)) setPrereqTip(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [prereqTip]);

  const handleUpvote = (e) => {
    e.stopPropagation();
    recordUpvote(driveId, userQuery || "");
    setFeedbackState("up");
  };

  const handleDownvote = (e) => {
    e.stopPropagation();
    recordDownvote(driveId, userQuery || "");
    setFeedbackState("down");
  };

  const handleCardClick = () => {
    if (onExpand) onExpand(driveId);
  };

  const toggleLesson = (section) => {
    setExpandedLesson((prev) => (prev === section ? null : section));
  };

  // Fallback thumbnail
  const thumbnailUrl = driveId ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w320` : null;

  // Extract MicroLesson sections
  const quickFix = microLesson?.quick_fix;
  const whyItWorks = microLesson?.why_it_works;
  const relatedSituations = microLesson?.related_situations;

  // Get doc passages — deduplicate by URL (multiple chunks from same page)
  const rawDocPassages = (retrievedPassages || []).filter((p) => p.source === "epic_docs");
  const docByUrl = new Map();
  for (const doc of rawDocPassages) {
    const url = doc.url || "";
    const existing = docByUrl.get(url);
    if (!existing || (doc.similarity || 0) > (existing.similarity || 0)) {
      docByUrl.set(url, doc);
    }
  }
  const docPassages = [...docByUrl.values()];

  return (
    <div
      ref={cardRef}
      className={`video-result-card ${isAdded ? "added" : ""} ${_curatedMatch ? "curated" : ""} ${feedbackState === "down" ? "demoted" : ""} ${isExpanded ? "expanded" : ""}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
    >
      {/* === Compact Card View (always visible) === */}
      <div className="vrc-compact">
        <div className="vrc-thumbnail">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <div className="vrc-thumb-fallback" style={{ display: thumbnailUrl ? "none" : "flex" }}>
            <span className="vrc-play-icon">
              <PlayCircle size={24} />
            </span>
          </div>
          {duration > 0 && <span className="vrc-duration">{formatDuration(duration)}</span>}
        </div>

        {_curatedMatch && <div className="vrc-curated-badge">✓ Known Solution</div>}
        {courseCode && isUE4Course(courseCode) && (
          <div className="vrc-ue4-badge" title="This content was created for Unreal Engine 4 — some details may differ in UE5">
            ⚠️ UE4 Content
          </div>
        )}

        {/* Role badge */}
        {role && (
          <div className="vrc-role-wrapper" ref={role === "prerequisite" ? tipRef : null}>
            <button
              className={`vrc-role-badge vrc-role-${role} ${role === "prerequisite" ? "vrc-role-clickable" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (role === "prerequisite") setPrereqTip((v) => !v);
              }}
              title={role === "prerequisite" ? "Click to see why this is a prerequisite" : undefined}
            >
              {role === "prerequisite" && "🔗 Prerequisite"}
              {role === "core" && "⭐ Core"}
              {role === "troubleshooting" && "🔧 Troubleshooting"}
              {role === "supplemental" && "📚 Supplemental"}
            </button>
            {prereqTip && role === "prerequisite" && (
              <div className="vrc-prereq-tooltip">
                <strong>Prerequisite Course</strong>
                {prereqCourses.length > 0 ? (
                  <>
                    <p>Watch these first:</p>
                    <ul className="vrc-prereq-list">
                      {prereqCourses.map((pc) => (
                        <li key={pc}>
                          📘 {courseTitles[pc] || pc}
                          {prereqEntry?.reasons?.[pc] && (
                            <span className="vrc-prereq-why"> — {prereqEntry.reasons[pc]}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>Watch this first — it covers foundational concepts needed before advancing.</p>
                )}
                {reason && <p className="vrc-tip-reason">{reason}</p>}
              </div>
            )}
          </div>
        )}

        <div className="vrc-info">
          <h4 className="vrc-title">{title}</h4>
          {reason && <p className="vrc-reason-preview">{reason}</p>}
        </div>

        {/* Actions row: feedback + add/remove */}
        <div className="vrc-actions">
          <div className="vrc-feedback">
            <button
              className={`vrc-fb-btn ${feedbackState === "up" ? "active-up" : ""}`}
              onClick={handleUpvote}
              aria-label="Helpful"
              title="This was helpful"
            >
              <span className="vrc-fb-emoji">👍</span>
            </button>
            <button
              className={`vrc-fb-btn ${feedbackState === "down" ? "active-down" : ""}`}
              onClick={handleDownvote}
              aria-label="Not helpful"
              title="Not relevant"
            >
              <span className="vrc-fb-emoji">👎</span>
            </button>
          </div>

          <button
            className={`vrc-add-btn ${isAdded ? "vrc-added" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(video);
            }}
            aria-label={isAdded ? "Remove from playlist" : "Add to playlist"}
          >
            {isAdded ? (
              <>
                <Check size={14} /> Added
              </>
            ) : (
              <>
                <Plus size={14} /> Add
              </>
            )}
          </button>
        </div>

        {/* Expand indicator */}
        <div className="vrc-expand-hint">
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>{isExpanded ? "Less" : "Details"}</span>
        </div>
      </div>

      {/* === Expanded Panel (progressive disclosure) === */}
      {isExpanded && (
        <div className="vrc-expanded-panel" onClick={(e) => e.stopPropagation()}>
          {/* Course & Tags Details */}
          <div className="vrc-details-row">
            {courseName && (
              <span className="vrc-detail-chip vrc-detail-course">📁 {courseName}</span>
            )}
            {matchedTags.length > 0 && (
              <span className="vrc-detail-chip vrc-detail-tags">
                🏷️ {matchedTags.slice(0, 4).join(", ")}
              </span>
            )}
          </div>

          {/* Reason */}
          {reason && <p className="vrc-expanded-reason">{reason}</p>}

          {/* Timestamp segments */}
          {topSegments.length > 0 && (
            <div className="vrc-expanded-segments">
              <span className="vrc-expanded-segments-label">
                <Clock size={12} /> Key Moments
              </span>
              {topSegments.slice(0, 3).map((seg, idx) => (
                <div key={idx} className="vrc-segment-hint">
                  <Clock size={12} className="vrc-clock-icon" />
                  <span className="vrc-seg-time">{seg.timestamp}</span>
                  <span className="vrc-seg-preview">
                    {seg.previewText.length > 80
                      ? seg.previewText.substring(0, 77) + "..."
                      : seg.previewText}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* MicroLesson Sections */}
          {microLesson && (
            <div className="vrc-micro-lesson">
              <div className="vrc-ml-header">
                <span className="vrc-ml-badge">✨ AI Lesson</span>
              </div>

              {/* ⚡ Quick Fix */}
              {quickFix && (
                <div className={`vrc-ml-section ${expandedLesson === "quick_fix" ? "expanded" : ""}`}>
                  <button className="vrc-ml-toggle" onClick={() => toggleLesson("quick_fix")}>
                    <span>⚡ {quickFix.title || "Quick Fix"}</span>
                    <span className="vrc-ml-chevron">{expandedLesson === "quick_fix" ? "▾" : "▸"}</span>
                  </button>
                  {expandedLesson === "quick_fix" && quickFix.steps && (
                    <ol className="vrc-ml-steps">
                      {quickFix.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {/* 🧠 Why This Works */}
              {whyItWorks && (
                <div className={`vrc-ml-section ${expandedLesson === "why" ? "expanded" : ""}`}>
                  <button className="vrc-ml-toggle" onClick={() => toggleLesson("why")}>
                    <span>🧠 Why This Works</span>
                    {whyItWorks.key_concept && (
                      <span className="vrc-ml-concept">{whyItWorks.key_concept}</span>
                    )}
                    <span className="vrc-ml-chevron">{expandedLesson === "why" ? "▾" : "▸"}</span>
                  </button>
                  {expandedLesson === "why" && (
                    <p className="vrc-ml-explanation">{whyItWorks.explanation}</p>
                  )}
                </div>
              )}

              {/* 🔗 Related Situations */}
              {relatedSituations && relatedSituations.length > 0 && (
                <div className={`vrc-ml-section ${expandedLesson === "related" ? "expanded" : ""}`}>
                  <button className="vrc-ml-toggle" onClick={() => toggleLesson("related")}>
                    <span>🔗 Related Situations</span>
                    <span className="vrc-ml-tag">{relatedSituations.length} scenarios</span>
                    <span className="vrc-ml-chevron">{expandedLesson === "related" ? "▾" : "▸"}</span>
                  </button>
                  {expandedLesson === "related" && (
                    <div className="vrc-ml-scenarios">
                      {relatedSituations.map((sit, i) => (
                        <div key={i} className="vrc-ml-scenario">
                          <strong>💡 {sit.scenario}</strong>
                          <p>{sit.connection}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 📚 Epic Docs Links */}
          {docPassages.length > 0 && (
            <div className="vrc-expanded-docs">
              <span className="vrc-expanded-docs-label">📚 Documentation</span>
              <div className="vrc-doc-chips">
                {docPassages.map((doc, i) => (
                  <a
                    key={i}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vrc-doc-chip"
                    title={doc.text?.slice(0, 200)}
                  >
                    📄 {doc.title || doc.section || "UE5 Docs"}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Collapse button */}
          <button
            className="vrc-collapse-btn"
            onClick={() => onExpand && onExpand(driveId)}
          >
            <ChevronUp size={14} /> Collapse
          </button>
        </div>
      )}
    </div>
  );
}

VideoResultCard.propTypes = {
  video: PropTypes.shape({
    driveId: PropTypes.string,
    title: PropTypes.string.isRequired,
    courseName: PropTypes.string,
    duration: PropTypes.number,
    matchedTags: PropTypes.arrayOf(PropTypes.string),
    courseCode: PropTypes.string,
    topSegments: PropTypes.array,
    docLinks: PropTypes.array,
    _curatedMatch: PropTypes.bool,
    role: PropTypes.oneOf(["prerequisite", "core", "troubleshooting", "supplemental"]),
    reason: PropTypes.string,
    estimatedMinutes: PropTypes.number,
  }).isRequired,
  isAdded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  userQuery: PropTypes.string,
  isExpanded: PropTypes.bool,
  onExpand: PropTypes.func,
  microLesson: PropTypes.object,
  retrievedPassages: PropTypes.array,
};
