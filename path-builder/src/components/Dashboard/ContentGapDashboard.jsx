/**
 * ContentGapDashboard — Persona-aware content gap analysis panel.
 *
 * Uses analyzeGaps() from ContentGapService to surface:
 *   - Coverage stats per persona
 *   - Required topic bars (covered vs missing)
 *   - Top relevant and "too technical" courses
 *   - Uncovered keyword gaps as recommendations
 */
import { useState, useMemo } from "react";
import { useTagData } from "../../context/TagDataContext";
import { getAllPersonas } from "../../services/PersonaService";
import { analyzeGaps } from "../../services/ContentGapService";
import "./ContentGapDashboard.css";

function ContentGapDashboard() {
  const { courses, tags } = useTagData();
  const allPersonas = getAllPersonas();

  // Pre-select from localStorage if available
  const [selectedPersonaId, setSelectedPersonaId] = useState(
    () => localStorage.getItem("ue5_persona_id") || allPersonas[0]?.id || ""
  );

  const [showRelevant, setShowRelevant] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  // Run gap analysis for the selected persona
  const analysis = useMemo(() => {
    if (!selectedPersonaId || courses.length === 0) {
      return null;
    }
    return analyzeGaps(selectedPersonaId, courses, tags);
  }, [selectedPersonaId, courses, tags]);

  if (!analysis) return null;

  const selectedPersona = allPersonas.find((p) => p.id === selectedPersonaId);
  const requiredTopics = analysis.coveredTopics
    .map((t) => ({ topic: t, covered: true }))
    .concat(analysis.missingTopics.map((t) => ({ topic: t, covered: false })));

  return (
    <div className="content-gap-dashboard">
      <div className="gap-dashboard-header">
        <h3 title="Analyze content coverage for each learner persona. Shows which required topics are covered, which are missing, and recommends content to fill gaps.">
          <span className="section-icon">🎯</span> Persona Content Gaps
        </h3>
      </div>

      {/* Persona Selector Chips */}
      <div className="gap-persona-chips">
        {allPersonas.map((p) => (
          <button
            key={p.id}
            className={`gap-chip ${selectedPersonaId === p.id ? "active" : ""}`}
            onClick={() => setSelectedPersonaId(p.id)}
            title={p.description}
          >
            {p.emoji} {p.name}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="gap-stats-row">
        <div className="gap-stat relevant" title="Courses with positive persona-relevance score">
          <div className="gap-stat-number">{analysis.relevantCount}</div>
          <div className="gap-stat-label">Relevant</div>
        </div>
        <div
          className="gap-stat technical"
          title="Courses penalised as irrelevant/too-technical for this persona"
        >
          <div className="gap-stat-number">{analysis.technicalCount}</div>
          <div className="gap-stat-label">Too Technical</div>
        </div>
        <div
          className="gap-stat topics"
          title="Required topics covered vs total required topics for this persona"
        >
          <div className="gap-stat-number">
            {analysis.coveredTopics.length}/{requiredTopics.length}
          </div>
          <div className="gap-stat-label">Topics Covered</div>
        </div>
        <div
          className="gap-stat keywords"
          title="Boost keywords with zero course matches — potential content to create"
        >
          <div className="gap-stat-number">{analysis.topGaps.length}</div>
          <div className="gap-stat-label">Keyword Gaps</div>
        </div>
      </div>

      {/* Topic Coverage Bars */}
      {requiredTopics.length > 0 && (
        <div className="gap-topic-section">
          <h4>
            Required Topics for {selectedPersona?.emoji} {selectedPersona?.name}
          </h4>
          <div className="gap-topic-bars">
            {requiredTopics.map((t) => (
              <div key={t.topic} className={`gap-topic-bar ${t.covered ? "covered" : "missing"}`}>
                <span className="gap-topic-icon">{t.covered ? "✅" : "❌"}</span>
                <span className="gap-topic-name">{t.topic}</span>
                <span className="gap-topic-status">{t.covered ? "Covered" : "Missing"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Relevant Courses */}
      {analysis.artistFriendly.length > 0 && (
        <div className="gap-list-section">
          <button className="gap-list-toggle" onClick={() => setShowRelevant(!showRelevant)}>
            🎨 Top Relevant Courses ({analysis.artistFriendly.length})
            <span className="toggle-icon">{showRelevant ? "▲" : "▼"}</span>
          </button>
          {showRelevant && (
            <div className="gap-course-list">
              {analysis.artistFriendly.slice(0, 15).map((c) => (
                <div key={c.code} className="gap-course-item relevant">
                  <span className="gap-course-code">{c.code}</span>
                  <span className="gap-course-title">{c.title}</span>
                  <span className="gap-course-score" title="Persona relevance score">
                    +{c.score}
                  </span>
                  <div className="gap-course-keywords">
                    {c.matchedBoosts.slice(0, 4).map((kw) => (
                      <span key={kw} className="gap-kw-tag boost">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Too Technical Courses */}
      {analysis.tooTechnical.length > 0 && (
        <div className="gap-list-section">
          <button
            className="gap-list-toggle technical"
            onClick={() => setShowTechnical(!showTechnical)}
          >
            ⚙️ Flagged as Too Technical ({analysis.tooTechnical.length})
            <span className="toggle-icon">{showTechnical ? "▲" : "▼"}</span>
          </button>
          {showTechnical && (
            <div className="gap-course-list">
              {analysis.tooTechnical.slice(0, 15).map((c) => (
                <div key={c.code} className="gap-course-item technical">
                  <span className="gap-course-code">{c.code}</span>
                  <span className="gap-course-title">{c.title}</span>
                  <span className="gap-course-score negative" title="Penalty score">
                    {c.score}
                  </span>
                  <div className="gap-course-keywords">
                    {c.matchedPenalties.slice(0, 4).map((kw) => (
                      <span key={kw} className="gap-kw-tag penalty">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Keyword Gaps — Content Recommendations */}
      {analysis.topGaps.length > 0 && (
        <div className="gap-recommendations">
          <h4>📝 Content to Create</h4>
          <p className="gap-rec-desc">
            These boost keywords for {selectedPersona?.emoji} {selectedPersona?.name} have zero
            course matches — creating content here would fill persona coverage gaps.
          </p>
          <div className="gap-keywords-grid">
            {analysis.topGaps.map((kw) => (
              <span key={kw} className="gap-missing-kw">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* All clear state */}
      {analysis.topGaps.length === 0 && analysis.missingTopics.length === 0 && (
        <div className="gap-all-clear">
          ✅ Full coverage! All required topics and keywords are represented for{" "}
          {selectedPersona?.emoji} {selectedPersona?.name}.
        </div>
      )}
    </div>
  );
}

export default ContentGapDashboard;
