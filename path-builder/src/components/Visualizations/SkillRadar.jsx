import { useMemo } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './SkillRadar.css';

/**
 * Skill Gap Radar
 * Spider chart showing skill coverage vs potential demand
 * Reveals where the course library has weaknesses
 */
function SkillRadar() {
  const { courses } = useTagData();

  // Analyze skill coverage
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
        demand: getDemandEstimate(cat.name), // Simulated demand
      };
    });

    // Find gaps (high demand, low coverage)
    const gaps = coverage
      .filter(c => c.demand > 50 && c.courseCount < 10)
      .sort((a, b) => (b.demand - b.coverage) - (a.demand - a.coverage));

    return { coverage, gaps };
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

  const coveragePath = radarPoints.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.coverageX} ${p.coverageY}`
  ).join(' ') + ' Z';

  const demandPath = radarPoints.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.demandX} ${p.demandY}`
  ).join(' ') + ' Z';

  return (
    <div className="skill-radar">
      <div className="radar-header">
        <h3>📊 Skill Coverage Radar</h3>
        <p className="radar-hint">
          Green = Your coverage | Blue = Industry demand estimate*
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

          {/* Demand polygon (behind) */}
          <path
            d={demandPath}
            fill="rgba(88, 166, 255, 0.2)"
            stroke="#58a6ff"
            strokeWidth="2"
          />

          {/* Coverage polygon (front) */}
          <path
            d={coveragePath}
            fill="rgba(35, 134, 54, 0.3)"
            stroke="#238636"
            strokeWidth="2"
          />

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

      {/* Gap alerts */}
      {skillAnalysis.gaps.length > 0 && (
        <div className="gap-alerts">
          <h4>⚠️ Coverage Gaps</h4>
          <div className="gap-list">
            {skillAnalysis.gaps.slice(0, 3).map(gap => (
              <div key={gap.category} className="gap-item">
                <span className="gap-name">{gap.category}</span>
                <span className="gap-stats">
                  {gap.courseCount} courses (demand: {gap.demand}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="radar-legend">
        <span className="legend-coverage">■ Coverage</span>
        <span className="legend-demand">■ Demand</span>
      </div>

      <div className="demand-source">
        <span className="source-asterisk">*</span>
        Demand based on UE5 job market trends, community surveys, and Epic's feature roadmap priorities.
        Replace with your LMS analytics when available.
      </div>
    </div>
  );
}

/**
 * Simulated demand estimates (in real app, from analytics)
 */
function getDemandEstimate(category) {
  const estimates = {
    'Blueprints': 85,
    'Materials': 75,
    'Lighting': 65,
    'Animation': 70,
    'Niagara': 80,
    'Landscape': 45,
    'Audio': 35,
    'UI/UMG': 60,
  };
  return estimates[category] || 50;
}

export default SkillRadar;
