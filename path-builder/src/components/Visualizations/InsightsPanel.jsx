import { useMemo, useState } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './InsightsPanel.css';

/**
 * Insights & Recommendations Panel
 * Analyzes course data and generates actionable suggestions
 */
function InsightsPanel() {
  const { courses } = useTagData();
  const [isExpanded, setIsExpanded] = useState(true);

  // Generate insights from data
  const insights = useMemo(() => {
    const results = [];

    // Skill categories with demand estimates
    const skillCategories = [
      { name: 'Blueprints', keywords: ['blueprint', 'visual scripting', 'bp'], demand: 90 },
      { name: 'Materials', keywords: ['material', 'shader', 'texture'], demand: 80 },
      { name: 'Niagara', keywords: ['niagara', 'particle', 'vfx'], demand: 85 },
      { name: 'Lighting', keywords: ['light', 'lumen', 'raytracing'], demand: 70 },
      { name: 'Animation', keywords: ['animation', 'skeletal', 'rigging'], demand: 75 },
      { name: 'UI/UMG', keywords: ['ui', 'umg', 'widget', 'hud'], demand: 65 },
      { name: 'Audio', keywords: ['audio', 'sound', 'metasound'], demand: 40 },
      { name: 'Landscape', keywords: ['landscape', 'terrain', 'foliage'], demand: 55 },
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

      const coverage = Math.min(100, (matchingCourses.length / courses.length) * 200);
      return {
        ...skill,
        courseCount: matchingCourses.length,
        coverage,
        gap: skill.demand - coverage
      };
    });

    // Skill Gap Insights (high demand, low coverage)
    const gaps = skillCoverage
      .filter(s => s.gap > 25 && s.courseCount < 10)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 2);

    gaps.forEach(gap => {
      results.push({
        type: 'gap',
        icon: '📈',
        title: `${gap.name} content opportunity`,
        description: `High industry demand (${gap.demand}%) but only ${gap.courseCount} courses. Consider adding more ${gap.name} content.`,
        priority: 'high'
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
        priority: 'info'
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
        priority: 'low'
      });
    }

    // Trending Topics (placeholder for future API integration)
    const trendingTopics = ['MetaHuman', 'PCG', 'Motion Design'];
    const hasTrending = trendingTopics.some(topic => 
      courses.some(c => 
        (c.title || '').toLowerCase().includes(topic.toLowerCase()) ||
        (c.gemini_system_tags || []).some(t => t.toLowerCase().includes(topic.toLowerCase()))
      )
    );

    if (!hasTrending) {
      results.push({
        type: 'trend',
        icon: '💡',
        title: 'Trending topic opportunity',
        description: 'MetaHuman, PCG, and Motion Design are trending in UE5. Consider adding related content.',
        priority: 'medium'
      });
    }

    return results.slice(0, 5); // Max 5 insights
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default InsightsPanel;
