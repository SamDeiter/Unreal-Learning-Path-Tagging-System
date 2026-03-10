/**
 * PathGapCard — Collapsible sidebar section showing gap analysis results
 *
 * Renders:
 *   1. Coverage Score Badge (green/amber/red)
 *   2. Blind Spots with severity + "Fill This Gap" / "Explore" buttons
 *   3. Assumed Knowledge chips
 *   4. Goal-Aware Suggestions
 *   5. Community Pain Points with source links
 *   6. Persona Selector (Beginner / Intermediate / Advanced)
 */

import { useState, useCallback } from "react";
import { simulatePersonaGaps } from "../../services/pathGapAnalyzer";

/**
 * Get coverage tier for CSS class.
 * @param {number} score - 0 to 1
 * @returns {"high"|"medium"|"low"}
 */
function getCoverageTier(score) {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

export default function PathGapCard({
  gaps,
  communityPainPoints,
  query,
  steps,
  onFillGap,
  onExplore,
  fillResults = {},
  onAddCourse,
  onAddSegment,
  onGenerateBespoke,
}) {
  const [expanded, setExpanded] = useState(false);
  const [personaGaps, setPersonaGaps] = useState(null);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [fillingTopic, setFillingTopic] = useState(null);

  // Use persona-overridden gaps if available, otherwise original
  const activeGaps = personaGaps || gaps;

  const handlePersonaChange = useCallback(
    async (e) => {
      const persona = e.target.value;
      if (persona === "default") {
        setPersonaGaps(null);
        return;
      }
      setPersonaLoading(true);
      try {
        const result = await simulatePersonaGaps(query, steps, persona);
        setPersonaGaps(result);
      } catch {
        // Non-fatal — keep existing gaps
      }
      setPersonaLoading(false);
    },
    [query, steps]
  );

  const handleFillGap = useCallback(
    async (topic) => {
      if (!onFillGap || fillingTopic) return;
      setFillingTopic(topic);
      try {
        await onFillGap(topic);
      } finally {
        setFillingTopic(null);
      }
    },
    [onFillGap, fillingTopic]
  );

  // Don't render if no gap data
  if (!gaps) return null;

  const coverageScore = activeGaps?.coverageScore ?? 1;
  const coveragePct = Math.round(coverageScore * 100);
  const tier = getCoverageTier(coverageScore);
  const blindSpots = activeGaps?.blindSpots || [];
  const assumedKnowledge = activeGaps?.assumedKnowledge || [];
  const suggestions = activeGaps?.suggestions || [];
  const painPoints = communityPainPoints || [];
  const totalIssues = blindSpots.length + assumedKnowledge.length;

  return (
    <div className="gap-card" id="gap-analysis-card">
      {/* Toggle Header */}
      <button
        className="gap-card-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        id="gap-card-toggle-btn"
      >
        <span className="gap-card-toggle-left">🔍 Gap Analysis</span>
        <span className={`gap-card-chevron ${expanded ? "expanded" : ""}`}>▶</span>
      </button>

      {/* Compact Summary (always visible) */}
      <div className="gap-card-summary">
        <span className={`coverage-badge ${tier}`} id="coverage-score-badge">
          {coveragePct}% coverage
        </span>
        {totalIssues > 0 && (
          <span className="gap-count-chip">
            {totalIssues} issue{totalIssues !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Expanded Body */}
      {expanded && (
        <div className="gap-card-body">
          {/* 1. Blind Spots */}
          {blindSpots.length > 0 && (
            <div id="blind-spots-section">
              <h4 className="gap-section-title">📋 Blind Spots</h4>
              {blindSpots.map((bs, i) => (
                <div key={i} className="blind-spot-item" data-severity={bs.severity}>
                  <div className="blind-spot-header">
                    <span className={`severity-dot ${bs.severity || "medium"}`} />
                    <span className="blind-spot-topic">{bs.topic}</span>
                  </div>
                  {bs.reason && <p className="blind-spot-reason">{bs.reason}</p>}
                  {bs.researchContext && (
                    <p className="blind-spot-research" title="Research context">
                      📚 {bs.researchContext}
                    </p>
                  )}

                  {/* ── 3-Tier Fill Results ── */}
                  {(() => {
                    const filled = fillResults[bs.topic];
                    if (!filled) {
                      // No results yet — show Fill / Explore buttons
                      return (
                        <div className="blind-spot-actions">
                          <button
                            className="gap-action-btn fill"
                            onClick={() => handleFillGap(bs.topic)}
                            disabled={fillingTopic === bs.topic}
                            id={`fill-gap-btn-${i}`}
                          >
                            {fillingTopic === bs.topic ? "Filling..." : "Fill This Gap"}
                          </button>
                          {onExplore && (
                            <button
                              className="gap-action-btn explore"
                              onClick={() => onExplore(bs.topic)}
                              id={`explore-btn-${i}`}
                            >
                              Explore
                            </button>
                          )}
                        </div>
                      );
                    }
                    if (filled.error) {
                      return (
                        <p className="blind-spot-reason" style={{ color: "#f85149" }}>
                          Could not generate fill
                        </p>
                      );
                    }
                    if (filled.source === "library") {
                      return (
                        <div className="gap-fill-tier">
                          <span className="gap-fill-tier-label">📚 Found in course library</span>
                          {filled.matchedCourses.map((mc) => (
                            <div key={mc.code} className="gap-fill-match">
                              <div className="gap-fill-match-info">
                                <strong>{mc.title || mc.code}</strong>
                                <span className="gap-fill-sim">
                                  {Math.round(mc.similarity * 100)}% match
                                </span>
                              </div>
                              {filled.addedCode === mc.code ? (
                                <span className="gap-fill-added">✅ Added</span>
                              ) : onAddCourse ? (
                                <button
                                  className="gap-action-btn fill"
                                  onClick={() => onAddCourse(mc, bs.topic)}
                                >
                                  ➕ Add
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    if (filled.source === "bespoke") {
                      return (
                        <div className="gap-fill-tier">
                          <span className="gap-fill-tier-label">🎬 Video segments found</span>
                          {filled.segments.slice(0, 3).map((seg, si) => (
                            <div key={si} className="gap-fill-segment">
                              <div className="gap-fill-seg-row">
                                <div className="gap-fill-seg-info">
                                  <div className="gap-fill-seg-title">{seg.title}</div>
                                  {seg.videoTitle && (
                                    <div className="gap-fill-seg-video">from: {seg.videoTitle}</div>
                                  )}
                                  <span className="gap-fill-sim">
                                    {Math.round(seg.similarity * 100)}% relevance
                                  </span>
                                </div>
                                {filled.addedSegments?.includes(si) ? (
                                  <span className="gap-fill-added">✅</span>
                                ) : onAddSegment ? (
                                  <button
                                    className="gap-action-btn fill"
                                    onClick={() => onAddSegment(seg, bs.topic, si)}
                                  >
                                    ➕
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                          {filled.bespokeGenerated ? (
                            <span className="gap-fill-added">✅ Bespoke step added</span>
                          ) : onGenerateBespoke ? (
                            <button
                              className="gap-action-btn fill"
                              onClick={() => onGenerateBespoke(filled.segments, bs.topic)}
                            >
                              🎬 Generate Bespoke Step
                            </button>
                          ) : null}
                        </div>
                      );
                    }
                    if (filled.source === "ai" && filled.step) {
                      return (
                        <div className="gap-fill-tier">
                          <span className="gap-fill-tier-label">🤖 AI-generated step</span>
                          <p className="gap-fill-added">✅ Step "{filled.step.title}" added</p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              ))}
            </div>
          )}

          {/* 2. Assumed Knowledge */}
          {assumedKnowledge.length > 0 && (
            <div id="assumed-knowledge-section">
              <h4 className="gap-section-title">⚠️ Assumed Knowledge</h4>
              <div className="assumed-knowledge-list">
                {assumedKnowledge.map((item, i) => (
                  <span key={i} className="assumed-chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3. Suggestions */}
          {suggestions.length > 0 && (
            <div id="suggestions-section">
              <h4 className="gap-section-title">💡 Suggestions</h4>
              {suggestions.map((s, i) => (
                <div key={i} className="suggestion-item">
                  <span className={`suggestion-priority ${s.priority || "medium"}`}>
                    {s.priority || "med"}
                  </span>
                  <div>
                    <div className="suggestion-text">{s.topic}</div>
                    {s.rationale && <div className="suggestion-rationale">{s.rationale}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 4. Community Pain Points */}
          {painPoints.length > 0 && (
            <div id="community-pain-points-section">
              <h4 className="gap-section-title">🌐 Community Pain Points</h4>
              {painPoints.map((pp, i) => (
                <div key={i} className="pain-point-item">
                  <span className="pain-point-text">{pp.painPoint}</span>
                  {pp.sourceUrl && (
                    <a
                      className="pain-point-source"
                      href={pp.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {pp.sourceTitle || pp.sourceUrl}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 5. Persona Selector */}
          <div className="persona-selector" id="persona-selector">
            <span className="persona-label">View as:</span>
            {personaLoading ? (
              <span className="persona-loading">Analyzing...</span>
            ) : (
              <select
                className="persona-select"
                onChange={handlePersonaChange}
                defaultValue="default"
                id="persona-select-dropdown"
              >
                <option value="default">Default</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
