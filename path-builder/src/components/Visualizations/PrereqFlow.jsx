import { useMemo } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './PrereqFlow.css';

/**
 * Prerequisite Flow Diagram
 * Shows recommended learning order based on tag relationships
 * Visualizes skill dependencies
 */
function PrereqFlow() {
  const { courses } = useTagData();

  // Build prerequisite flow data
  const flowData = useMemo(() => {
    // Helper to safely get level string
    const getLevelString = (c) => {
      const raw = c.level || c.difficulty || '';
      return typeof raw === 'string' ? raw.toLowerCase() : '';
    };

    // Group courses by level
    const levels = {
      beginner: courses.filter(c => getLevelString(c).includes('beginner')),
      intermediate: courses.filter(c => getLevelString(c).includes('intermediate')),
      advanced: courses.filter(c => getLevelString(c).includes('advanced'))
    };

    // Find common tags at each level
    const levelTags = {};
    Object.entries(levels).forEach(([level, levelCourses]) => {
      const tagCounts = new Map();
      levelCourses.forEach(course => {
        const tags = [
          ...(course.gemini_system_tags || []),
          ...(course.ai_tags || [])
        ];
        tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });
      levelTags[level] = [...tagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([tag, count]) => ({ tag, count }));
    });

    // Build suggested flow connections
    const connections = [];
    if (levelTags.beginner.length && levelTags.intermediate.length) {
      connections.push({
        from: 'Beginner',
        to: 'Intermediate',
        bridgeTags: levelTags.beginner
          .filter(b => levelTags.intermediate.some(i => 
            i.tag.toLowerCase().includes(b.tag.toLowerCase().split(' ')[0])
          ))
          .slice(0, 3)
      });
    }
    if (levelTags.intermediate.length && levelTags.advanced.length) {
      connections.push({
        from: 'Intermediate',
        to: 'Advanced',
        bridgeTags: levelTags.intermediate
          .filter(i => levelTags.advanced.some(a => 
            a.tag.toLowerCase().includes(i.tag.toLowerCase().split(' ')[0])
          ))
          .slice(0, 3)
      });
    }

    return { levels, levelTags, connections };
  }, [courses]);

  return (
    <div className="prereq-flow">
      <div className="flow-header">
        <h3>🔀 Learning Progression</h3>
        <p className="flow-hint">Recommended skill flow by difficulty level</p>
      </div>

      <div className="flow-levels">
        {['beginner', 'intermediate', 'advanced'].map((level, idx) => (
          <div key={level} className="flow-level-column">
            <div className={`level-badge level-${level}`}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
              <span className="level-count">{flowData.levels[level]?.length || 0}</span>
            </div>
            <div className="level-tags">
              {flowData.levelTags[level]?.map(({ tag, count }) => (
                <div key={tag} className="flow-tag">
                  <span className="tag-name">{tag}</span>
                  <span className="tag-count">{count}</span>
                </div>
              ))}
            </div>
            {idx < 2 && (
              <div className="flow-arrow">→</div>
            )}
          </div>
        ))}
      </div>

      <div className="flow-insights">
        <h4>📌 Key Progressions</h4>
        {flowData.connections.map((conn, i) => (
          <div key={i} className="progression-item">
            <span className="prog-from">{conn.from}</span>
            <span className="prog-arrow">→</span>
            <span className="prog-to">{conn.to}</span>
            {conn.bridgeTags.length > 0 && (
              <span className="prog-via">
                via {conn.bridgeTags.map(t => t.tag).join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PrereqFlow;
