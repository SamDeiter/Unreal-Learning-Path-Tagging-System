import React, { useMemo } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './JourneyHeatmap.css';

// Topic categories with keyword aliases for flexible matching
const TOPIC_CONFIG = [
  { name: 'Blueprints', keywords: ['blueprint', 'blueprints', 'scripting', 'visual scripting'] },
  { name: 'Materials', keywords: ['material', 'materials', 'shader', 'texture', 'textures'] },
  { name: 'Lighting', keywords: ['lighting', 'light', 'lumen', 'illumination', 'gi'] },
  { name: 'Animation', keywords: ['animation', 'animations', 'skeletal', 'rigging', 'sequencer'] },
  { name: 'Landscape', keywords: ['landscape', 'terrain', 'foliage', 'environment', 'world building'] },
  { name: 'Rendering', keywords: ['rendering', 'nanite', 'ray tracing', 'raytracing', 'post process'] },
  { name: 'Cinematics', keywords: ['cinematic', 'cinematics', 'camera', 'sequencer', 'film'] },
];

/**
 * Learning Journey Heatmap
 * Shows when learners typically take courses by difficulty/topic
 * Reveals optimal learning progressions
 */
function JourneyHeatmap() {
  const { courses } = useTagData();

  // Build heatmap data
  const heatmapData = useMemo(() => {
    const levels = ['Beginner', 'Intermediate', 'Advanced'];
    const topics = [...TOPIC_CONFIG.map(t => t.name), 'Other'];

    const matrix = levels.map(level =>
      topics.map(topic => {
        const matching = courses.filter(c => {
          // Get level - prefer gemini_skill_level, then tags.level, then map numeric difficulty
          let courseLevel = '';
          if (c.gemini_skill_level) {
            courseLevel = c.gemini_skill_level.toLowerCase();
          } else if (c.tags?.level) {
            courseLevel = (typeof c.tags.level === 'string' ? c.tags.level : '').toLowerCase();
          } else if (typeof c.difficulty === 'number') {
            if (c.difficulty <= 2) courseLevel = 'beginner';
            else if (c.difficulty === 3) courseLevel = 'intermediate';
            else courseLevel = 'advanced';
          }
          const levelMatch = courseLevel.includes(level.toLowerCase());
          
          // Combine all tags into searchable text
          const allTags = [
            ...(c.gemini_system_tags || []),
            ...(c.ai_tags || []),
            ...(c.canonical_tags || []),
            c.topic || '',
            c.title || ''
          ].map(t => typeof t === 'string' ? t.toLowerCase() : '').join(' ');
          
          // Match topic using keywords
          let topicMatch = false;
          if (topic === 'Other') {
            // "Other" = doesn't match ANY of the defined topic keywords
            topicMatch = !TOPIC_CONFIG.some(tc => 
              tc.keywords.some(kw => allTags.includes(kw))
            );
          } else {
            const config = TOPIC_CONFIG.find(tc => tc.name === topic);
            topicMatch = config?.keywords.some(kw => allTags.includes(kw)) || false;
          }
          
          return levelMatch && topicMatch;
        });

        return {
          level,
          topic,
          count: matching.length,
          duration: matching.reduce((sum, c) => sum + (c.duration_minutes || 0), 0),
          courses: matching.slice(0, 5)
        };
      })
    );

    const maxCount = Math.max(...matrix.flat().map(c => c.count), 1);

    return { matrix, levels, topics, maxCount };
  }, [courses]);

  const getHeatColor = (count, max) => {
    if (count === 0) return 'rgba(33, 38, 45, 0.8)';
    const intensity = count / max;
    if (intensity < 0.25) return 'rgba(35, 134, 54, 0.3)';
    if (intensity < 0.5) return 'rgba(35, 134, 54, 0.5)';
    if (intensity < 0.75) return 'rgba(35, 134, 54, 0.7)';
    return 'rgba(35, 134, 54, 0.9)';
  };

  return (
    <div className="journey-heatmap">
      <div className="heatmap-header">
        <h3>🗺️ Learning Journey Heatmap
          <span className="info-tooltip">ⓘ
            <span className="tooltip-content">
              <strong>What this shows:</strong>
              <ul>
                <li>Rows = difficulty levels</li>
                <li>Columns = topic areas</li>
                <li>Darker cells = more courses available</li>
              </ul>
              <strong>How to use:</strong>
              <ul>
                <li>Identify content-rich vs sparse areas</li>
                <li>Click cells to see courses within</li>
              </ul>
            </span>
          </span>
        </h3>
        <p className="heatmap-hint">Darker = more courses available</p>
      </div>

      <div className="heatmap-grid">
        {/* Header row */}
        <div className="heatmap-corner"></div>
        {heatmapData.topics.map(topic => (
          <div key={topic} className="heatmap-col-header">{topic}</div>
        ))}

        {/* Data rows */}
        {heatmapData.matrix.map((row, rowIdx) => (
          <React.Fragment key={`row-${rowIdx}`}>
            <div className="heatmap-row-header">
              {heatmapData.levels[rowIdx]}
            </div>
            {row.map((cell, colIdx) => {
              const hours = Math.round(cell.duration / 60 * 10) / 10; // 1 decimal place
              return (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  className="heatmap-cell"
                  style={{ background: getHeatColor(cell.count, heatmapData.maxCount) }}
                  title={`${cell.count} courses, ${hours}h total`}
                >
                  <span className="cell-count">{cell.count}</span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="heatmap-legend">
        <span>0</span>
        <div className="legend-gradient"></div>
        <span>{heatmapData.maxCount}+</span>
      </div>
    </div>
  );
}

export default JourneyHeatmap;
