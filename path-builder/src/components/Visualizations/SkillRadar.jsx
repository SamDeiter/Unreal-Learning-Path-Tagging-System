import { useMemo } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './SkillRadar.css';

/**
 * Skill Coverage Radar
 * Spider chart showing actual skill coverage from your course library
 * All data derived from real course tags - no estimated/fake data
 */
function SkillRadar() {
  const { courses } = useTagData();

  // Analyze skill coverage from actual course data
  const skillAnalysis = useMemo(() => {
    // Define skill categories to measure
    const skillCategories = [
      { name: 'Blueprints', keywords: ['blueprint', 'visual scripting', 'bp', 'logic', 'node'] },
      { name: 'Materials', keywords: ['material', 'shader', 'texture', 'pbr', 'substance'] },
      { name: 'Lighting', keywords: ['light', 'lumen', 'raytracing', 'gi', 'shadow'] },
      { name: 'Animation', keywords: ['animation', 'skeletal', 'rigging', 'anim', 'pose'] },
      { name: 'Niagara', keywords: ['niagara', 'particle', 'vfx', 'effects', 'cascade'] },
      { name: 'Landscape', keywords: ['landscape', 'terrain', 'foliage', 'world'] },
      { name: 'Audio', keywords: ['audio', 'sound', 'music', 'acoustic'] },
      { name: 'UI/UMG', keywords: ['ui', 'umg', 'widget', 'hud', 'interface'] },
    ];

    // Count courses per category
    const coverage = skillCategories.map(cat => {
      const matchingCourses = courses.filter(course => {
        const allTags = [
          ...(course.gemini_system_tags || []),
          ...(course.ai_tags || []),
          ...(course.transcript_tags || []),
          ...Object.keys(course.tags || {})
        ].map(t => t.toLowerCase());
        
        return cat.keywords.some(kw => 
          allTags.some(tag => tag.includes(kw))
        );
      });

      return {
        category: cat.name,
        courseCount: matchingCourses.length,
        coverage: Math.min(100, (matchingCourses.length / courses.length) * 200), // Scale for visibility
      };
    });

    // Sort by coverage to highlight strengths/weaknesses
    const sortedByCoverage = [...coverage].sort((a, b) => b.courseCount - a.courseCount);
    const topSkills = sortedByCoverage.slice(0, 3);
    const bottomSkills = sortedByCoverage.slice(-3).reverse();

    return { coverage, topSkills, bottomSkills };
  }, [courses]);

  // Calculate SVG points for radar
  const radarPoints = useMemo(() => {
    const centerX = 150;
    const centerY = 150;
    const maxRadius = 120;
    const angleStep = (Math.PI * 2) / skillAnalysis.coverage.length;

    return skillAnalysis.coverage.map((skill, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const coverageRadius = (skill.coverage / 100) * maxRadius;

      return {
        ...skill,
        coverageX: centerX + Math.cos(angle) * coverageRadius,
        coverageY: centerY + Math.sin(angle) * coverageRadius,
        labelX: centerX + Math.cos(angle) * (maxRadius + 25),
        labelY: centerY + Math.sin(angle) * (maxRadius + 25),
      };
    });
  }, [skillAnalysis]);

  const coveragePath = radarPoints.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.coverageX} ${p.coverageY}`
  ).join(' ') + ' Z';

  return (
    <div className="skill-radar">
      <div className="radar-header">
        <h3>📊 Skill Coverage Radar
          <span className="info-tooltip">ⓘ
            <span className="tooltip-content">
              <strong>What this shows:</strong>
              <ul>
                <li>Each axis = a skill category</li>
                <li>Distance from center = relative coverage</li>
                <li>Based on actual tags in your library</li>
              </ul>
              <strong>How to use:</strong>
              <ul>
                <li>Identify well-covered vs sparse topics</li>
                <li>Plan content to balance the shape</li>
              </ul>
            </span>
          </span>
        </h3>
        <p className="radar-hint">
          Coverage based on {courses.length} courses in your library
        </p>
      </div>

      <div className="radar-chart">
        <svg viewBox="0 0 300 300" className="radar-svg">
          {/* Grid circles */}
          {[25, 50, 75, 100].map(pct => (
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

          {/* Coverage polygon */}
          <path
            d={coveragePath}
            fill="rgba(35, 134, 54, 0.3)"
            stroke="#238636"
            strokeWidth="2"
          />

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
      </div>

      {/* Coverage stats */}
      <div className="coverage-stats">
        <div className="stats-column">
          <h4>💪 Strongest</h4>
          {skillAnalysis.topSkills.map(skill => (
            <div key={skill.category} className="stat-item strength">
              <span className="stat-name">{skill.category}</span>
              <span className="stat-count">{skill.courseCount} courses</span>
            </div>
          ))}
        </div>
        <div className="stats-column">
          <h4>📈 Opportunity</h4>
          {skillAnalysis.bottomSkills.map(skill => (
            <div key={skill.category} className="stat-item opportunity">
              <span className="stat-name">{skill.category}</span>
              <span className="stat-count">{skill.courseCount} courses</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SkillRadar;

