import { useMemo } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './InstructorMap.css';

/**
 * Course Categories Map
 * Shows course distribution by category from folder structure
 * Reveals topic coverage and content depth
 */
function InstructorMap() {
  const { courses } = useTagData();

  // Analyze course categories from folder names
  const categoryData = useMemo(() => {
    const categoryMap = new Map();

    courses.forEach(course => {
      // Extract category from path (e.g., "19-Worldbuilding")
      let category = 'Other';
      
      if (course.path) {
        const pathMatch = course.path.match(/\\(\d+-[^\\]+)\\/);
        if (pathMatch) {
          category = pathMatch[1].replace(/^\d+-/, ''); // Remove leading number
        }
      } else if (course.folder_name) {
        const parts = course.folder_name.split('-');
        if (parts.length >= 2) {
          category = parts[1] || 'Other';
        }
      }
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          name: category,
          courses: [],
          topics: new Set(),
          totalDuration: 0
        });
      }
      const data = categoryMap.get(category);
      data.courses.push(course);
      data.totalDuration += course.duration_minutes || 0;
      
      // Extract topics from tags
      const tagTopics = [
        ...(course.gemini_system_tags || []),
        ...(course.ai_tags || [])
      ];
      tagTopics.slice(0, 4).forEach(t => data.topics.add(t));
    });

    return [...categoryMap.values()]
      .filter(c => c.name !== 'Other' && c.courses.length >= 1)
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
        <h3>📁 Course Categories
          <span className="info-tooltip">ⓘ
            <span className="tooltip-content">
              <strong>What this shows:</strong>
              <ul>
                <li>Courses grouped by folder category</li>
                <li>Course count and total hours per category</li>
                <li>Common tags within each category</li>
              </ul>
              <strong>How to use:</strong>
              <ul>
                <li>See your library's content distribution</li>
                <li>Identify well-covered vs sparse categories</li>
              </ul>
            </span>
          </span>
        </h3>
        <p className="instructor-hint">Distribution by folder structure</p>
      </div>

      <div className="instructor-grid">
        {categoryData.map(category => (
          <div key={category.name} className="instructor-card">
            <div className="instructor-name">{category.name}</div>
            <div className="instructor-stats">
              <span>{category.courses.length} courses</span>
              <span>{Math.round(category.totalDuration / 60)}h</span>
            </div>
            <div className="instructor-topics">
              {[...category.topics].slice(0, 4).map(topic => (
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

      {categoryData.length === 0 && (
        <div className="instructor-empty">
          <p>No category data available.</p>
        </div>
      )}
    </div>
  );
}

export default InstructorMap;
