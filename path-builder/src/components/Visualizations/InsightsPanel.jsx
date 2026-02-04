import { useMemo, useState } from 'react';
import { useTagData } from '../../context/TagDataContext';
import curatorData from '../../data/curator_insights.json';
import externalData from '../../data/external_sources.json';
import './InsightsPanel.css';

/**
 * Insights & Recommendations Panel
 * Analyzes course data and generates actionable suggestions
 */
function InsightsPanel({ onNavigate }) {
  const { courses } = useTagData();
  const [isExpanded, setIsExpanded] = useState(true);

  // Generate insights from data
  const insights = useMemo(() => {
    const results = [];

    // Skill categories - just keywords, no fake demand numbers
    const skillCategories = [
      { name: 'Blueprints', keywords: ['blueprint', 'visual scripting', 'bp'] },
      { name: 'Materials', keywords: ['material', 'shader', 'texture'] },
      { name: 'Niagara', keywords: ['niagara', 'particle', 'vfx'] },
      { name: 'Lighting', keywords: ['light', 'lumen', 'raytracing'] },
      { name: 'Animation', keywords: ['animation', 'skeletal', 'rigging'] },
      { name: 'UI/UMG', keywords: ['ui', 'umg', 'widget', 'hud'] },
      { name: 'Audio', keywords: ['audio', 'sound', 'metasound'] },
      { name: 'Landscape', keywords: ['landscape', 'terrain', 'foliage'] },
    ];

    // Calculate coverage for each skill
    const skillCoverage = skillCategories.map(skill => {
      const matchingCourses = courses.filter(course => {
        const allTags = [
          ...(course.gemini_system_tags || []),
          ...(course.ai_tags || []),
          course.title || ''
        ].map(t => t.toLowerCase());
        
        return skill.keywords.some(kw => 
          allTags.some(tag => tag.includes(kw))
        );
      });

      return {
        ...skill,
        courseCount: matchingCourses.length
      };
    });

    // Low Coverage Insights - topics with very few courses
    const lowCoverage = skillCoverage
      .filter(s => s.courseCount > 0 && s.courseCount < 10)
      .sort((a, b) => a.courseCount - b.courseCount)
      .slice(0, 2);

    lowCoverage.forEach(item => {
      results.push({
        type: 'gap',
        icon: '📈',
        title: `${item.name} has limited coverage`,
        description: `Only ${item.courseCount} courses cover ${item.name}. This may be an opportunity to expand.`,
        source: `Searched for "${item.keywords.join('", "')}" in course tags and titles`,
        priority: 'medium',
        skillName: item.name,
        actionable: true
      });
    });

    // Strength Insights (what you're doing well)
    const strengths = skillCoverage
      .filter(s => s.courseCount >= 15)
      .sort((a, b) => b.courseCount - a.courseCount)
      .slice(0, 1);

    strengths.forEach(strength => {
      results.push({
        type: 'strength',
        icon: '✅',
        title: `Strong ${strength.name} coverage`,
        description: `${strength.courseCount} courses covering ${strength.name}—well above average library depth.`,
        source: `Counted ${strength.courseCount} courses matching ${strength.name} keywords`,
        priority: 'info',
        skillName: strength.name,
        actionable: true
      });
    });

    // Level Gap Insights
    const getLevelString = (c) => {
      if (c.gemini_skill_level) return c.gemini_skill_level.toLowerCase();
      if (c.tags?.level && typeof c.tags.level === 'string') return c.tags.level.toLowerCase();
      return '';
    };

    const levels = {
      beginner: courses.filter(c => getLevelString(c).includes('beginner')).length,
      intermediate: courses.filter(c => getLevelString(c).includes('intermediate')).length,
      advanced: courses.filter(c => getLevelString(c).includes('advanced')).length
    };

    if (levels.advanced < 5 && levels.beginner > 20) {
      results.push({
        type: 'level',
        icon: '🎓',
        title: 'Advanced content gap',
        description: `Only ${levels.advanced} advanced courses vs ${levels.beginner} beginner. Consider creating expert-level content.`,
        source: `Analyzed gemini_skill_level tags: ${levels.beginner} beginner, ${levels.intermediate} intermediate, ${levels.advanced} advanced`,
        priority: 'medium'
      });
    }

    // Duration Distribution Insight
    const shortCourses = courses.filter(c => (c.duration_minutes || 30) < 30).length;
    
    if (shortCourses > courses.length * 0.7) {
      results.push({
        type: 'duration',
        icon: '⏱️',
        title: 'Content format opportunity',
        description: `${Math.round(shortCourses/courses.length*100)}% of courses are under 30 min. Consider adding deeper workshop-style content.`,
        source: `${shortCourses} of ${courses.length} courses have duration_minutes < 30`,
        priority: 'low'
      });
    }

    // Add curator-provided insights (from JSON file)
    if (curatorData?.insights) {
      curatorData.insights.forEach(insight => {
        results.push({
          type: insight.type || 'curator',
          icon: insight.icon || '🎯',
          title: insight.title,
          description: insight.description,
          source: insight.source,
          priority: insight.priority || 'medium'
        });
      });
    }

    // Add external sources (Google Trends, YouTube, etc.)
    if (externalData?.insights) {
      externalData.insights.forEach(insight => {
        results.push({
          type: insight.type || 'external',
          icon: insight.icon || '📊',
          title: insight.title,
          description: insight.description,
          source: insight.source,
          priority: insight.priority || 'low'
        });
      });
    }

    return results.slice(0, 8); // Max 8 insights
  }, [courses]);

  if (insights.length === 0) return null;

  return (
    <div className={`insights-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="insights-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>
          💡 Insights & Recommendations
          <span className="insight-count">{insights.length}</span>
        </h3>
        <button className="toggle-btn">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="insights-list">
          {insights.map((insight, idx) => (
            <div key={idx} className={`insight-card priority-${insight.priority}`}>
              <span className="insight-icon">{insight.icon}</span>
              <div className="insight-content">
                <strong>{insight.title}</strong>
                <p>{insight.description}</p>
                {insight.source && (
                  <span className="insight-source">📊 {insight.source}</span>
                )}
                {insight.actionable && insight.skillName && onNavigate && (
                  <div className="insight-actions">
                    <button 
                      className="insight-action-btn primary"
                      onClick={() => onNavigate('builder', insight.skillName)}
                    >
                      🎯 Start Path
                    </button>
                    <button 
                      className="insight-action-btn secondary"
                      onClick={() => onNavigate('builder', insight.skillName)}
                    >
                      📚 View Courses
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default InsightsPanel;
