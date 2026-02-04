import { useMemo } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './TagTimeline.css';

/**
 * Tag Evolution Timeline
 * Shows how tag usage changes over course length/complexity
 * Reveals skill progression patterns
 */
function TagTimeline() {
  const { courses } = useTagData();

  // Analyze tag distribution by duration buckets
  const timelineData = useMemo(() => {
    // Duration buckets
    const buckets = [
      { label: '< 15 min', min: 0, max: 15 },
      { label: '15-30 min', min: 15, max: 30 },
      { label: '30-60 min', min: 30, max: 60 },
      { label: '1-2 hours', min: 60, max: 120 },
      { label: '2+ hours', min: 120, max: Infinity },
    ];

    // Track tag frequencies in each bucket
    const bucketData = buckets.map(bucket => {
      const bucketCourses = courses.filter(c => {
        const duration = c.duration_minutes || 30;
        return duration >= bucket.min && duration < bucket.max;
      });

      // Count tags
      const tagCounts = new Map();
      bucketCourses.forEach(course => {
        const tags = [
          ...(course.gemini_system_tags || []),
          ...(course.ai_tags || [])
        ];
        tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });

      // Top tags for this bucket
      const topTags = [...tagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }));

      return {
        ...bucket,
        courseCount: bucketCourses.length,
        topTags,
        avgDuration: bucketCourses.length > 0
          ? Math.round(bucketCourses.reduce((sum, c) => sum + (c.duration_minutes || 0), 0) / bucketCourses.length)
          : 0
      };
    });

    return bucketData;
  }, [courses]);

  const maxCourses = Math.max(...timelineData.map(b => b.courseCount), 1);

  return (
    <div className="tag-timeline">
      <div className="timeline-header">
        <h3>⏱️ Tag Distribution by Duration
          <span className="info-tooltip">ⓘ
            <span className="tooltip-content">
              <strong>What this shows:</strong>
              <ul>
                <li>Bar height = number of courses</li>
                <li>Grouped by course duration</li>
                <li>Top tags shown for each duration range</li>
              </ul>
              <strong>How to use:</strong>
              <ul>
                <li>See which topics suit quick tutorials vs deep dives</li>
                <li>Identify content length patterns</li>
              </ul>
            </span>
          </span>
        </h3>
        <p className="timeline-hint">Which topics are covered in short vs long courses</p>
      </div>

      <div className="timeline-chart">
        {timelineData.map((bucket) => (
          <div key={bucket.label} className="timeline-column">
            <div className="column-bar-container">
              <div 
                className="column-bar"
                style={{ height: `${(bucket.courseCount / maxCourses) * 100}%` }}
              >
                <span className="bar-count">{bucket.courseCount}</span>
              </div>
            </div>
            <div className="column-label">{bucket.label}</div>
            <div className="column-tags">
              {bucket.topTags.slice(0, 3).map(({ tag }) => (
                <span key={tag} className="mini-tag">{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="timeline-insights">
        <div className="insight-item">
          <span className="insight-label">Quick learns (&lt;15m):</span>
          <span className="insight-value">
            {timelineData[0]?.topTags[0]?.tag || 'N/A'}
          </span>
        </div>
        <div className="insight-item">
          <span className="insight-label">Deep dives (2h+):</span>
          <span className="insight-value">
            {timelineData[4]?.topTags[0]?.tag || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default TagTimeline;
