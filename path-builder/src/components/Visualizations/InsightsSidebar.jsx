import "./InsightsSidebar.css";

/**
 * InsightsSidebar — Pure-CSS mini-visualizations for the Insights panel.
 * Renders 3 data-driven charts: Skill Coverage, Level Distribution, Duration Breakdown.
 */
function InsightsSidebar({ skillCoverage, levels, durationBuckets, totalCourses }) {
  // Sort skills by course count descending for the bar chart
  const sortedSkills = [...skillCoverage].sort((a, b) => b.courseCount - a.courseCount);
  const maxSkillCount = sortedSkills[0]?.courseCount || 1;

  // Level distribution
  const totalLeveled = levels.beginner + levels.intermediate + levels.advanced;
  const levelPct = (count) => (totalLeveled > 0 ? ((count / totalLeveled) * 100).toFixed(1) : "0");

  // Duration totals
  const totalDuration = Object.values(durationBuckets).reduce((s, v) => s + v, 0) || 1;
  const durationPct = (count) => ((count / totalDuration) * 100).toFixed(1);

  const durationEntries = [
    { label: "< 15 min", count: durationBuckets.under15, color: "var(--accent-green, #3fb950)" },
    { label: "15–30 min", count: durationBuckets.under30, color: "var(--accent-blue, #58a6ff)" },
    { label: "30–60 min", count: durationBuckets.under60, color: "var(--accent-purple, #a371f7)" },
    { label: "60+ min", count: durationBuckets.over60, color: "var(--accent-orange, #d29922)" },
  ];

  return (
    <div className="insights-sidebar">
      {/* Skill Coverage Bars */}
      <div className="sidebar-card">
        <h4 className="sidebar-card-title">📊 Skill Coverage</h4>
        <p className="sidebar-card-subtitle">{totalCourses} courses scanned</p>
        <div className="skill-bars">
          {sortedSkills.map((skill) => (
            <div key={skill.name} className="skill-bar-row">
              <span className="skill-bar-label">{skill.name}</span>
              <div className="skill-bar-track">
                <div
                  className="skill-bar-fill"
                  style={{ width: `${(skill.courseCount / maxSkillCount) * 100}%` }}
                />
              </div>
              <span className="skill-bar-count">{skill.courseCount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Level Distribution */}
      <div className="sidebar-card">
        <h4 className="sidebar-card-title">🎓 Level Distribution</h4>
        <p className="sidebar-card-subtitle">{totalLeveled} courses with levels</p>
        <div className="level-stacked-bar">
          {levels.beginner > 0 && (
            <div
              className="level-segment level-beginner"
              style={{ width: `${levelPct(levels.beginner)}%` }}
              title={`Beginner: ${levels.beginner} (${levelPct(levels.beginner)}%)`}
            />
          )}
          {levels.intermediate > 0 && (
            <div
              className="level-segment level-intermediate"
              style={{ width: `${levelPct(levels.intermediate)}%` }}
              title={`Intermediate: ${levels.intermediate} (${levelPct(levels.intermediate)}%)`}
            />
          )}
          {levels.advanced > 0 && (
            <div
              className="level-segment level-advanced"
              style={{ width: `${levelPct(levels.advanced)}%` }}
              title={`Advanced: ${levels.advanced} (${levelPct(levels.advanced)}%)`}
            />
          )}
        </div>
        <div className="level-legend">
          <span className="level-legend-item">
            <span className="level-dot level-dot-beginner" />
            Beginner <strong>{levelPct(levels.beginner)}%</strong>
          </span>
          <span className="level-legend-item">
            <span className="level-dot level-dot-intermediate" />
            Intermediate <strong>{levelPct(levels.intermediate)}%</strong>
          </span>
          <span className="level-legend-item">
            <span className="level-dot level-dot-advanced" />
            Advanced <strong>{levelPct(levels.advanced)}%</strong>
          </span>
        </div>
      </div>

      {/* Duration Breakdown */}
      <div className="sidebar-card">
        <h4 className="sidebar-card-title">⏱️ Duration Breakdown</h4>
        <p className="sidebar-card-subtitle">Content format balance</p>
        <div className="duration-bars">
          {durationEntries.map((d) => (
            <div key={d.label} className="duration-bar-row">
              <span className="duration-bar-label">{d.label}</span>
              <div className="duration-bar-track">
                <div
                  className="duration-bar-fill"
                  style={{
                    width: `${durationPct(d.count)}%`,
                    background: d.color,
                  }}
                />
              </div>
              <span className="duration-bar-pct">{durationPct(d.count)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default InsightsSidebar;
