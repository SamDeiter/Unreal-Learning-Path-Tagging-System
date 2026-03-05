import { useMemo, useState } from "react";
import { useTagData } from "../../context/TagDataContext";
import { SKILL_CATEGORIES, courseMatchesKeywords } from "./skillMatchUtils";
import demandData from "../../data/demand_benchmarks.json";
import "./SkillRadar.css";

// Industry demand benchmarks — sourced from demand_benchmarks.json
const INDUSTRY_DEMAND = demandData.benchmarks;
const DEMAND_VERSION = demandData.version;
const DEMAND_SOURCE = demandData.source;

/**
 * Skill Coverage Radar
 * Spider chart showing actual skill coverage vs industry demand
 * Green = your coverage, Blue = industry demand benchmarks
 */
function SkillRadar() {
  const { courses } = useTagData();
  const [showDemand, setShowDemand] = useState(true);

  // Analyze skill coverage from actual course data
  const skillAnalysis = useMemo(() => {
    // Count courses per category with per-keyword breakdown
    // Uses shared SKILL_CATEGORIES + word-boundary matching from skillMatchUtils
    const coverage = SKILL_CATEGORIES.map((cat) => {
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

      return {
        category: cat.name,
        courseCount: matchingCourses.length,
        coverage: Math.min(100, (matchingCourses.length / courses.length) * 200), // Scale for visibility
        demand: INDUSTRY_DEMAND[cat.name] || 50, // Industry demand benchmark
        keywordHits,
      };
    });

    // Sort by coverage to highlight strengths/weaknesses
    const sortedByCoverage = [...coverage].sort((a, b) => b.courseCount - a.courseCount);
    const topSkills = sortedByCoverage.slice(0, 3);
    const bottomSkills = sortedByCoverage.slice(-3).reverse();

    // Calculate gap analysis
    const gaps = coverage
      .map((c) => ({
        ...c,
        gap: c.demand - c.coverage,
      }))
      .sort((a, b) => b.gap - a.gap);

    return {
      coverage,
      topSkills,
      bottomSkills,
      gaps,
      computedAt: new Date(),
      totalCourses: courses.length,
    };
  }, [courses]);

  // Calculate SVG points for radar (including demand points)
  const radarPoints = useMemo(() => {
    const centerX = 150;
    const centerY = 150;
    const maxRadius = 120;
    const angleStep = (Math.PI * 2) / skillAnalysis.coverage.length;

    return skillAnalysis.coverage.map((skill, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const coverageRadius = (skill.coverage / 100) * maxRadius;
      const demandRadius = (skill.demand / 100) * maxRadius;

      return {
        ...skill,
        coverageX: centerX + Math.cos(angle) * coverageRadius,
        coverageY: centerY + Math.sin(angle) * coverageRadius,
        demandX: centerX + Math.cos(angle) * demandRadius,
        demandY: centerY + Math.sin(angle) * demandRadius,
        labelX: centerX + Math.cos(angle) * (maxRadius + 25),
        labelY: centerY + Math.sin(angle) * (maxRadius + 25),
      };
    });
  }, [skillAnalysis]);

  const coveragePath =
    radarPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.coverageX} ${p.coverageY}`).join(" ") +
    " Z";

  const demandPath =
    radarPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.demandX} ${p.demandY}`).join(" ") + " Z";

  return (
    <div className="skill-radar">
      <div className="radar-header">
        <h3>
          📊 Coverage vs Industry Demand
          <span className="info-tooltip">
            ⓘ
            <span className="tooltip-content">
              <strong>What this shows:</strong>
              <ul>
                <li>🟢 Green = Your library coverage</li>
                <li>🔵 Blue = Industry demand benchmarks</li>
                <li>Gap = Where demand exceeds coverage</li>
              </ul>
              <strong>Coverage source:</strong>
              <ul>
                <li>
                  Keyword matching against <code>gemini_system_tags</code>, <code>ai_tags</code>,{" "}
                  <code>transcript_tags</code>, and <code>tags</code> on all{" "}
                  {skillAnalysis.totalCourses} courses
                </li>
                <li>Formula: (matched / total) × 200, capped at 100%</li>
              </ul>
              <strong>Demand source:</strong>
              <ul>
                <li>Hardcoded benchmarks from UE5 Skill Demand Research (Jan 2024)</li>
                <li>Based on Epic roadmap priorities + job market analysis</li>
                <li>
                  Values: Blueprints 90%, Niagara 85%, Materials 80%, Animation 75%, Lighting 70%,
                  UI/UMG 65%, Landscape 55%, Audio 40%
                </li>
              </ul>
              <strong>Why it changes:</strong>
              <ul>
                <li>Coverage recalculates when courses are added/removed or tags change</li>
                <li>Demand values are static and do not change</li>
              </ul>
            </span>
          </span>
        </h3>
        <div className="radar-controls">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showDemand}
              onChange={(e) => setShowDemand(e.target.checked)}
            />
            Show Industry Demand
          </label>
        </div>
      </div>

      <div className="radar-chart">
        <svg viewBox="-30 -10 360 320" className="radar-svg">
          {/* Grid circles */}
          {[25, 50, 75, 100].map((pct) => (
            <circle
              key={pct}
              cx="150"
              cy="150"
              r={(pct / 100) * 120}
              fill="none"
              stroke="#30363d"
              strokeWidth="1"
            />
          ))}

          {/* Axis lines */}
          {radarPoints.map((point, i) => (
            <line
              key={i}
              x1="150"
              y1="150"
              x2={point.labelX}
              y2={point.labelY}
              stroke="#30363d"
              strokeWidth="1"
            />
          ))}

          {/* Industry Demand polygon (behind) */}
          {showDemand && (
            <path
              d={demandPath}
              fill="rgba(88, 166, 255, 0.2)"
              stroke="#58a6ff"
              strokeWidth="2"
              strokeDasharray="5,3"
            />
          )}

          {/* Your Coverage polygon (front) */}
          <path d={coveragePath} fill="rgba(35, 134, 54, 0.3)" stroke="#238636" strokeWidth="2" />

          {/* Data points */}
          {radarPoints.map((point, i) => (
            <circle
              key={`point-${i}`}
              cx={point.coverageX}
              cy={point.coverageY}
              r="4"
              fill="#238636"
              stroke="#0d1117"
              strokeWidth="1"
            />
          ))}

          {/* Labels */}
          {radarPoints.map((point, i) => (
            <text
              key={i}
              x={point.labelX}
              y={point.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="radar-label"
            >
              {point.category}
            </text>
          ))}
        </svg>

        {/* Legend */}
        <div className="radar-legend">
          <span className="legend-item coverage">
            <span className="legend-dot"></span> Your Coverage
          </span>
          {showDemand && (
            <span className="legend-item demand">
              <span className="legend-dot"></span> Industry Demand
            </span>
          )}
        </div>
      </div>

      {/* Coverage stats */}
      <div className="coverage-stats">
        <div className="stats-column">
          <h4>💪 Strongest</h4>
          {skillAnalysis.topSkills.map((skill) => (
            <div key={skill.category} className="stat-item strength">
              <span className="stat-name">{skill.category}</span>
              <span className="stat-count">{skill.courseCount} courses</span>
            </div>
          ))}
        </div>
        <div className="stats-column">
          <h4>📈 Opportunity</h4>
          {skillAnalysis.bottomSkills.map((skill) => (
            <div key={skill.category} className="stat-item opportunity">
              <span className="stat-name">{skill.category}</span>
              <span className="stat-count">{skill.courseCount} courses</span>
            </div>
          ))}
        </div>
      </div>

      {/* Data provenance footer */}
      <div className="radar-provenance">
        <span>📋 {skillAnalysis.totalCourses} courses scanned via tag keywords</span>
        <span>
          📊 Demand: {DEMAND_SOURCE} ({DEMAND_VERSION})
        </span>
        <span>
          🕐 Computed:{" "}
          {skillAnalysis.computedAt.toLocaleString("en-US", {
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

export default SkillRadar;
