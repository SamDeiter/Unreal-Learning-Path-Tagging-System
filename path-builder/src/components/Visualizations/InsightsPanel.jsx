import { useMemo, useState } from "react";
import { useTagData } from "../../context/TagDataContext";
import { SKILL_CATEGORIES, courseMatchesKeywords } from "./skillMatchUtils";
import curatorData from "../../data/curator_insights.json";
import externalData from "../../data/external_sources.json";
import InsightsSidebar from "./InsightsSidebar";
import "./InsightsPanel.css";

/**
 * Insights & Recommendations Panel
 * Analyzes course data and generates actionable suggestions
 * Two-column layout: insights list (left) + mini-visualizations (right)
 */
function InsightsPanel({ onNavigate }) {
  const { courses } = useTagData();
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate skill coverage for both insights and sidebar
  const skillCoverage = useMemo(() => {
    return SKILL_CATEGORIES.map((skill) => {
      const matchingCourses = courses.filter((course) =>
        courseMatchesKeywords(course, skill.keywords)
      );
      return {
        ...skill,
        courseCount: matchingCourses.length,
      };
    });
  }, [courses]);

  // Level distribution for sidebar
  const levels = useMemo(() => {
    const getLevelString = (c) => {
      if (c.gemini_skill_level) return c.gemini_skill_level.toLowerCase();
      if (c.tags?.level && typeof c.tags.level === "string") return c.tags.level.toLowerCase();
      return "";
    };

    return {
      beginner: courses.filter((c) => getLevelString(c).includes("beginner")).length,
      intermediate: courses.filter((c) => getLevelString(c).includes("intermediate")).length,
      advanced: courses.filter((c) => getLevelString(c).includes("advanced")).length,
    };
  }, [courses]);

  // Duration buckets for sidebar
  const durationBuckets = useMemo(() => {
    const buckets = { under15: 0, under30: 0, under60: 0, over60: 0 };
    courses.forEach((c) => {
      const dur = c.duration_minutes || 0;
      if (dur < 15) buckets.under15++;
      else if (dur < 30) buckets.under30++;
      else if (dur < 60) buckets.under60++;
      else buckets.over60++;
    });
    return buckets;
  }, [courses]);

  // Generate insights from data
  const insights = useMemo(() => {
    const results = [];

    // Low Coverage Insights - topics with very few courses
    const lowCoverage = skillCoverage
      .filter((s) => s.courseCount > 0 && s.courseCount < 10)
      .sort((a, b) => a.courseCount - b.courseCount)
      .slice(0, 2);

    lowCoverage.forEach((item) => {
      results.push({
        type: "gap",
        icon: "📈",
        title: `${item.name} has limited coverage`,
        description: `Only ${item.courseCount} courses cover ${item.name}. This may be an opportunity to expand.`,
        source: `Searched for "${item.keywords.join('", "')}" in course tags and titles`,
        priority: "medium",
        skillName: item.name,
        actionable: true,
      });
    });

    // Strength Insights (what you're doing well)
    const strengths = skillCoverage
      .filter((s) => s.courseCount >= 15)
      .sort((a, b) => b.courseCount - a.courseCount)
      .slice(0, 1);

    strengths.forEach((strength) => {
      results.push({
        type: "strength",
        icon: "✅",
        title: `Strong ${strength.name} coverage`,
        description: `${strength.courseCount} courses covering ${strength.name}—well above average library depth.`,
        source: `Counted ${strength.courseCount} courses matching ${strength.name} keywords`,
        priority: "info",
        skillName: strength.name,
        actionable: true,
      });
    });

    // Level Gap Insights
    if (levels.advanced < 5 && levels.beginner > 20) {
      results.push({
        type: "level",
        icon: "🎓",
        title: "Advanced content gap",
        description: `Only ${levels.advanced} advanced courses vs ${levels.beginner} beginner. Consider creating expert-level content.`,
        source: `Analyzed gemini_skill_level tags: ${levels.beginner} beginner, ${levels.intermediate} intermediate, ${levels.advanced} advanced`,
        priority: "medium",
      });
    }

    // Duration Distribution Insight
    const shortCourses = courses.filter((c) => (c.duration_minutes || 30) < 30).length;

    if (shortCourses > courses.length * 0.7) {
      results.push({
        type: "duration",
        icon: "⏱️",
        title: "Content format opportunity",
        description: `${Math.round((shortCourses / courses.length) * 100)}% of courses are under 30 min. Consider adding deeper workshop-style content.`,
        source: `${shortCourses} of ${courses.length} courses have duration_minutes < 30`,
        priority: "low",
      });
    }

    // Add curator-provided insights (from JSON file)
    if (curatorData?.insights) {
      curatorData.insights.forEach((insight) => {
        results.push({
          type: insight.type || "curator",
          icon: insight.icon || "🎯",
          title: insight.title,
          description: insight.description,
          source: insight.source,
          priority: insight.priority || "medium",
        });
      });
    }

    // Add external sources (Google Trends, YouTube, etc.)
    if (externalData?.insights) {
      externalData.insights.forEach((insight) => {
        results.push({
          type: insight.type || "external",
          icon: insight.icon || "📊",
          title: insight.title,
          description: insight.description,
          source: insight.source,
          priority: insight.priority || "low",
        });
      });
    }

    return results.slice(0, 8); // Max 8 insights
  }, [courses, skillCoverage, levels]);

  if (insights.length === 0) return null;

  return (
    <div className={`insights-panel ${isExpanded ? "expanded" : "collapsed"}`}>
      <div className="insights-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>
          💡 Insights & Recommendations
          <span className="insight-count">{insights.length}</span>
        </h3>
        <button className="toggle-btn">{isExpanded ? "▼" : "▶"}</button>
      </div>

      {isExpanded && (
        <div className="insights-body">
          {/* Left column: insight cards */}
          <div className="insights-list">
            {insights.map((insight, idx) => (
              <div key={idx} className={`insight-card priority-${insight.priority}`}>
                <span className="insight-icon">{insight.icon}</span>
                <div className="insight-content">
                  <strong>{insight.title}</strong>
                  <p>{insight.description}</p>
                  {insight.source && <span className="insight-source">📊 {insight.source}</span>}
                  {insight.actionable && insight.skillName && onNavigate && (
                    <div className="insight-actions">
                      <button
                        className="insight-action-btn primary"
                        onClick={() => onNavigate("builder", insight.skillName)}
                      >
                        🎯 Start Path
                      </button>
                      <button
                        className="insight-action-btn secondary"
                        onClick={() => onNavigate("builder", insight.skillName)}
                      >
                        📚 View Courses
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Right column: mini-visualizations */}
          <InsightsSidebar
            skillCoverage={skillCoverage}
            levels={levels}
            durationBuckets={durationBuckets}
            totalCourses={courses.length}
          />
        </div>
      )}
    </div>
  );
}

export default InsightsPanel;
