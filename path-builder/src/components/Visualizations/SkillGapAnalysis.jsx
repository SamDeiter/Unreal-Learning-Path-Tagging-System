import { useMemo } from "react";
import { useTagData } from "../../context/TagDataContext";
import { SKILL_CATEGORIES, courseMatchesKeywords } from "./skillMatchUtils";
import demandData from "../../data/demand_benchmarks.json";
import "./SkillGapAnalysis.css";

// Industry demand benchmarks — sourced from demand_benchmarks.json
const INDUSTRY_DEMAND = demandData.benchmarks;
const DEMAND_VERSION = demandData.version;
const DEMAND_SOURCE = demandData.source;

// Lookup helper: handles aliases like "Niagara/VFX" → "Niagara"
function getDemand(categoryName) {
  if (INDUSTRY_DEMAND[categoryName] !== undefined) return INDUSTRY_DEMAND[categoryName];
  // Try base name (strip /suffix)
  const base = categoryName.split("/")[0];
  return INDUSTRY_DEMAND[base] ?? 50;
}

/**
 * Skill Gap Analysis
 * Side-by-side bar chart comparing your coverage vs industry demand
 * Visually highlights where you're ahead or behind market needs
 */
function SkillGapAnalysis() {
  const { courses } = useTagData();

  // Analyze skill coverage from actual course data
  // Uses shared SKILL_CATEGORIES + word-boundary matching from skillMatchUtils
  const gapAnalysis = useMemo(() => {
    return SKILL_CATEGORIES.map((cat) => {
      const keywordHits = {};
      cat.keywords.forEach((kw) => {
        keywordHits[kw] = 0;
      });

      const matchingCourses = courses.filter((course) => {
        return courseMatchesKeywords(course, cat.keywords, {
          includeTranscriptTags: true,
          includeTagKeys: true,
          keywordHits,
        });
      });

      const coverage = Math.min(100, (matchingCourses.length / courses.length) * 200);
      const demand = getDemand(cat.name);
      const gap = demand - coverage;

      return {
        category: cat.name,
        courseCount: matchingCourses.length,
        coverage: Math.round(coverage),
        demand,
        gap: Math.round(gap),
        status: gap > 15 ? "behind" : gap > 0 ? "close" : "ahead",
        keywordHits,
      };
    }).sort((a, b) => b.gap - a.gap); // Sort by gap (biggest gaps first)
  }, [courses]);

  const computedAt = useMemo(() => new Date(), [gapAnalysis]); // eslint-disable-line react-hooks/exhaustive-deps

  // Summary stats
  const summary = useMemo(() => {
    const behind = gapAnalysis.filter((g) => g.status === "behind").length;
    const ahead = gapAnalysis.filter((g) => g.status === "ahead").length;
    const avgGap = Math.round(gapAnalysis.reduce((sum, g) => sum + g.gap, 0) / gapAnalysis.length);
    return { behind, ahead, avgGap };
  }, [gapAnalysis]);

  return (
    <div className="skill-gap-analysis">
      <div className="gap-header">
        <h3>
          📊 Skill Gap Analysis
          <span className="info-tooltip">
            ⓘ
            <span className="tooltip-content">
              <strong>What this shows:</strong>
              <ul>
                <li>🟢 Green bar = Your coverage exceeds demand</li>
                <li>🟡 Yellow = Close to industry demand</li>
                <li>🔴 Red gap = Demand exceeds coverage</li>
              </ul>
              <strong>Coverage source:</strong>
              <ul>
                <li>
                  Keyword matching against <code>gemini_system_tags</code>, <code>ai_tags</code>,{" "}
                  <code>transcript_tags</code>, and <code>tags</code> on all {courses.length}{" "}
                  courses
                </li>
                <li>Hover each skill row to see per-keyword match counts</li>
              </ul>
              <strong>Demand source:</strong>
              <ul>
                <li>Hardcoded benchmarks from UE5 Skill Demand Research (Jan 2024)</li>
                <li>Based on Epic roadmap priorities + job market analysis</li>
              </ul>
              <strong>Why it changes:</strong>
              <ul>
                <li>Coverage recalculates when courses are added/removed or tags change</li>
              </ul>
            </span>
          </span>
        </h3>
        <div className="gap-summary">
          <span className={`summary-stat ${summary.avgGap > 0 ? "negative" : "positive"}`}>
            {summary.avgGap > 0 ? `−${summary.avgGap}%` : `+${Math.abs(summary.avgGap)}%`} avg gap
          </span>
          <span className="summary-stat behind">{summary.behind} skills need focus</span>
          <span className="summary-stat ahead">{summary.ahead} skills ahead</span>
        </div>
      </div>

      <div className="gap-chart">
        {gapAnalysis.map((skill) => (
          <div
            key={skill.category}
            className={`gap-row ${skill.status}`}
            title={`Keyword matches: ${Object.entries(skill.keywordHits)
              .map(([kw, count]) => `${kw}: ${count}`)
              .join(", ")}`}
          >
            <div className="skill-label">
              <span className="skill-name">{skill.category}</span>
              <span className="skill-count">{skill.courseCount} courses</span>
            </div>
            <div className="bar-container">
              {/* Coverage bar (your library) */}
              <div
                className="bar coverage-bar"
                style={{ width: `${skill.coverage}%` }}
                title={`Your coverage: ${skill.coverage}%`}
              >
                {skill.coverage >= 20 && <span className="bar-label">{skill.coverage}%</span>}
              </div>
              {/* Demand marker */}
              <div
                className="demand-marker"
                style={{ left: `${skill.demand}%` }}
                title={`Industry demand: ${skill.demand}%`}
              >
                <span className="marker-line"></span>
                <span className="marker-label">{skill.demand}%</span>
              </div>
            </div>
            <div className="gap-indicator">
              {skill.gap > 0 ? (
                <span className="gap-value negative">−{skill.gap}%</span>
              ) : (
                <span className="gap-value positive">+{Math.abs(skill.gap)}%</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="gap-legend">
        <span className="legend-item">
          <span className="legend-bar coverage"></span> Your Coverage
        </span>
        <span className="legend-item">
          <span className="legend-marker"></span> Industry Demand
        </span>
      </div>

      {/* Data provenance footer */}
      <div className="gap-provenance">
        <span>📋 {courses.length} courses scanned via tag keywords</span>
        <span>
          📊 Demand: {DEMAND_SOURCE} ({DEMAND_VERSION})
        </span>
        <span>
          🕐 Computed:{" "}
          {computedAt.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

export default SkillGapAnalysis;
