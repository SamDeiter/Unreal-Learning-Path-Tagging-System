import { useMemo } from 'react';
import tagHistory from '../../data/tag_history.json';
import './TagTrends.css';

/**
 * Tag Trends Over Time
 * Shows historical changes in tag usage across snapshots
 */
function TagTrends() {
  const { snapshots } = tagHistory;
  
  // Get all unique tags and sort by latest count
  const allTags = useMemo(() => {
    const tags = new Set();
    snapshots.forEach(s => Object.keys(s.tags || {}).forEach(t => tags.add(t)));
    return Array.from(tags).sort((a, b) => {
      const latest = snapshots[snapshots.length - 1]?.tags || {};
      return (latest[b] || 0) - (latest[a] || 0);
    }).slice(0, 8);
  }, [snapshots]);

  const colors = [
    '#58a6ff', '#a371f7', '#3fb950', '#f0883e',
    '#f778ba', '#db6d28', '#768390', '#54aeff'
  ];

  const maxValue = useMemo(() => {
    let max = 0;
    snapshots.forEach(s => {
      allTags.forEach(tag => {
        if ((s.tags?.[tag] || 0) > max) max = s.tags[tag];
      });
    });
    return max || 1;
  }, [snapshots, allTags]);

  // Need at least 2 snapshots for trends
  if (snapshots.length < 2) {
    return (
      <div className="tag-trends">
        <div className="trends-header">
          <h4>📊 Tag Trends Over Time</h4>
          <span className="trends-subtitle">Tracking weekly changes</span>
        </div>
        <div className="trends-placeholder">
          <div className="placeholder-icon">📅</div>
          <p><strong>Collecting data...</strong></p>
          <p className="trends-hint">
            Weekly snapshots will show how tag usage changes over time.
            First snapshot collected. Check back next week!
          </p>
          <div className="current-snapshot">
            <strong>Current Snapshot ({snapshots[0]?.date || 'N/A'})</strong>
            <div className="snapshot-tags">
              {allTags.slice(0, 5).map((tag, i) => (
                <span key={tag} className="snapshot-tag" style={{ borderColor: colors[i] }}>
                  {tag}: {snapshots[0]?.tags?.[tag] || 0}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tag-trends">
      <div className="trends-header">
        <h4>📊 Tag Trends Over Time</h4>
        <span className="trends-subtitle">{snapshots.length} weeks tracked</span>
      </div>
      
      <div className="trends-chart">
        <div className="chart-grid">
          {[100, 75, 50, 25, 0].map(pct => (
            <div key={pct} className="grid-line" style={{ bottom: `${pct}%` }}>
              <span className="grid-label">{Math.round(maxValue * pct / 100)}</span>
            </div>
          ))}
        </div>
        
        <div className="chart-lines">
          {allTags.map((tag, i) => (
            <svg key={tag} className="trend-line" viewBox={`0 0 ${(snapshots.length - 1) * 100} 100`}>
              <polyline
                fill="none"
                stroke={colors[i]}
                strokeWidth="2"
                points={snapshots.map((s, j) => {
                  const x = j * 100;
                  const y = 100 - ((s.tags?.[tag] || 0) / maxValue) * 100;
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          ))}
        </div>
        
        <div className="chart-x-axis">
          {snapshots.map((s, i) => (
            <span key={i} className="x-label">
              {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          ))}
        </div>
      </div>
      
      <div className="trends-legend">
        {allTags.map((tag, i) => {
          const latest = snapshots[snapshots.length - 1]?.tags?.[tag] || 0;
          const prev = snapshots[snapshots.length - 2]?.tags?.[tag] || 0;
          const change = latest - prev;
          return (
            <div key={tag} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: colors[i] }} />
              <span className="legend-label">{tag}</span>
              <span className={`legend-change ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>
                {change > 0 ? `+${change}` : change}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TagTrends;
