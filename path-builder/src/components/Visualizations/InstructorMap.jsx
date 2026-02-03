import { useMemo } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './InstructorMap.css';

/**
 * Instructor Coverage Map
 * Shows which instructors cover which topics
 * Reveals expertise gaps and potential collaborations
 */
function InstructorMap() {
  const { courses } = useTagData();

  // Analyze instructor coverage
  const instructorData = useMemo(() => {
    const instructorMap = new Map();

    courses.forEach(course => {
      const instructor = course.instructor || course.author || 'Unknown';
      if (!instructorMap.has(instructor)) {
        instructorMap.set(instructor, {
          name: instructor,
          courses: [],
          topics: new Set(),
          totalDuration: 0,
          levels: new Set()
        });
      }
      const data = instructorMap.get(instructor);
      data.courses.push(course);
      data.totalDuration += course.duration_minutes || 0;
      
      if (course.topic) data.topics.add(course.topic);
      if (course.level || course.difficulty) {
        data.levels.add(course.level || course.difficulty);
      }
      
      // Extract topics from tags
      const tagTopics = [
        ...(course.gemini_system_tags || []),
        ...(course.ai_tags || [])
      ];
      tagTopics.forEach(t => {
        if (['blueprint', 'material', 'lighting', 'animation', 'ui', 'audio', 'niagara'].some(
          topic => t.toLowerCase().includes(topic)
        )) {
          data.topics.add(t);
        }
      });
    });

    return [...instructorMap.values()]
      .filter(i => i.name !== 'Unknown' && i.courses.length >= 2)
      .sort((a, b) => b.courses.length - a.courses.length)
      .slice(0, 12);
  }, [courses]);

  const getTopicColor = (topic) => {
    const lower = topic.toLowerCase();
    if (lower.includes('blueprint')) return '#58a6ff';
    if (lower.includes('material')) return '#a371f7';
    if (lower.includes('light')) return '#f0e68c';
    if (lower.includes('animation') || lower.includes('anim')) return '#3fb950';
    if (lower.includes('ui') || lower.includes('umg')) return '#f85149';
    if (lower.includes('niagara') || lower.includes('vfx')) return '#ff7b72';
    return '#8b949e';
  };

  return (
    <div className="instructor-map">
      <div className="instructor-header">
        <h3>👨‍🏫 Instructor Coverage</h3>
        <p className="instructor-hint">Who teaches what topics</p>
      </div>

      <div className="instructor-grid">
        {instructorData.map(instructor => (
          <div key={instructor.name} className="instructor-card">
            <div className="instructor-name">{instructor.name}</div>
            <div className="instructor-stats">
              <span>{instructor.courses.length} courses</span>
              <span>{Math.round(instructor.totalDuration / 60)}h</span>
            </div>
            <div className="instructor-topics">
              {[...instructor.topics].slice(0, 4).map(topic => (
                <span
                  key={topic}
                  className="topic-badge"
                  style={{ background: getTopicColor(topic) + '33', color: getTopicColor(topic) }}
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {instructorData.length === 0 && (
        <div className="instructor-empty">
          <p>No instructor data available.</p>
        </div>
      )}
    </div>
  );
}

export default InstructorMap;
