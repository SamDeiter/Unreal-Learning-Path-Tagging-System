import React, { useMemo } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './JourneyHeatmap.css';

/**
 * Learning Journey Heatmap
 * Shows when learners typically take courses by difficulty/topic
 * Reveals optimal learning progressions
 */
function JourneyHeatmap() {
  const { courses } = useTagData();

  // Build heatmap data
  const heatmapData = useMemo(() => {
    // Group by difficulty level and topic
    const levels = ['Beginner', 'Intermediate', 'Advanced'];
    const topics = ['Blueprints', 'Materials', 'Lighting', 'Animation', 'UI', 'Audio', 'Other'];

    const matrix = levels.map(level =>
      topics.map(topic => {
        const matching = courses.filter(c => {
          // Safely get level as string
          const rawLevel = c.difficulty || c.level || 'beginner';
          const courseLevel = (typeof rawLevel === 'string' ? rawLevel : String(rawLevel)).toLowerCase();
          const levelMatch = courseLevel.includes(level.toLowerCase());
          
          const allTags = [
            ...(c.gemini_system_tags || []),
            ...(c.ai_tags || []),
            c.topic || ''
          ].map(t => typeof t === 'string' ? t.toLowerCase() : '').join(' ');
          
          const topicMatch = topic === 'Other' 
            ? !topics.slice(0, -1).some(t => allTags.includes(t.toLowerCase()))
            : allTags.includes(topic.toLowerCase());
          
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
        <h3>🗺️ Learning Journey Heatmap</h3>
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
            {row.map((cell, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className="heatmap-cell"
                style={{ background: getHeatColor(cell.count, heatmapData.maxCount) }}
                title={`${cell.count} courses, ${cell.duration} min total`}
              >
                <span className="cell-count">{cell.count}</span>
              </div>
            ))}
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
