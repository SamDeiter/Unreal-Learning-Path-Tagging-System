import { useMemo, useState } from "react";
import tagHistoryData from "../../data/tag_history.json";
import "./TagHistorySparkline.css";

/**
 * Tag History Sparkline
 * Mini SVG sparkline showing tag count trends from tag_history.json snapshots.
 * Each tag gets a sparkline; hovering shows date + count.
 */
function TagHistorySparkline() {
  const [hoveredTag, setHoveredTag] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);

  const { tagNames, tagSeries, dates, totalSeries } = useMemo(() => {
    const snapshots = tagHistoryData.snapshots || [];
    if (snapshots.length === 0) return { tagNames: [], tagSeries: {}, dates: [], totalSeries: [] };

    const dates = snapshots.map((s) => s.date);
    const totalSeries = snapshots.map((s) => s.totalCourses);

    // Collect all unique tag names across all snapshots
    const tagSet = new Set();
    snapshots.forEach((s) => Object.keys(s.tags || {}).forEach((t) => tagSet.add(t)));
    const tagNames = [...tagSet].sort(
      (a, b) =>
        (snapshots[snapshots.length - 1].tags[b] || 0) -
        (snapshots[snapshots.length - 1].tags[a] || 0)
    );

    // Build series per tag
    const tagSeries = {};
    for (const tag of tagNames) {
      tagSeries[tag] = snapshots.map((s) => s.tags[tag] || 0);
    }

    return { tagNames, tagSeries, dates, totalSeries };
  }, []);

  if (tagNames.length === 0 || dates.length < 2) {
    return (
      <div className="sparkline-container">
        <h3 className="sparkline-title">📈 Tag Growth Trends</h3>
        <p className="sparkline-empty">Need at least 2 snapshots for trend data.</p>
      </div>
    );
  }

  // SVG sparkline renderer
  const renderSparkline = (series, width = 80, height = 24, color = "#6366f1") => {
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;

    const points = series.map((val, i) => {
      const x = (i / (series.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    });

    return (
      <svg width={width} height={height} className="sparkline-svg">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dot on latest value */}
        {series.length > 0 &&
          (() => {
            const lastVal = series[series.length - 1];
            const x = width;
            const y = height - ((lastVal - min) / range) * (height - 4) - 2;
            return <circle cx={x} cy={y} r="2.5" fill={color} />;
          })()}
      </svg>
    );
  };

  const latestDate = dates[dates.length - 1];
  const firstDate = dates[0];

  return (
    <div className="sparkline-container">
      <div className="sparkline-header">
        <h3 className="sparkline-title">📈 Tag Growth Trends</h3>
        <span className="sparkline-date-range">
          {firstDate} → {latestDate} ({dates.length} snapshots)
        </span>
      </div>

      {/* Total courses sparkline */}
      <div className="sparkline-total-row">
        <span className="sparkline-total-label">Total Courses</span>
        {renderSparkline(totalSeries, 100, 28, "#10b981")}
        <span className="sparkline-total-value">
          {totalSeries[totalSeries.length - 1]}
          <span className="sparkline-delta">
            {totalSeries[totalSeries.length - 1] - totalSeries[0] > 0 ? "+" : ""}
            {totalSeries[totalSeries.length - 1] - totalSeries[0]}
          </span>
        </span>
      </div>

      {/* Per-tag sparklines */}
      <div className="sparkline-grid">
        {tagNames.map((tag) => {
          const series = tagSeries[tag];
          const latest = series[series.length - 1];
          const first = series[0];
          const delta = latest - first;
          const isHovered = hoveredTag === tag;

          return (
            <div
              key={tag}
              className={`sparkline-row ${isHovered ? "sparkline-row-hovered" : ""}`}
              onMouseEnter={() => {
                setHoveredTag(tag);
                setTooltipData({ tag, series, dates });
              }}
              onMouseLeave={() => {
                setHoveredTag(null);
                setTooltipData(null);
              }}
            >
              <span className="sparkline-tag-name" title={tag}>
                {tag}
              </span>
              {renderSparkline(series)}
              <span className="sparkline-value">
                {latest}
                {delta !== 0 && (
                  <span className={`sparkline-delta ${delta > 0 ? "positive" : "negative"}`}>
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hover tooltip */}
      {tooltipData && (
        <div className="sparkline-tooltip">
          <strong>{tooltipData.tag}</strong>
          <div className="sparkline-tooltip-series">
            {tooltipData.dates.map((d, i) => (
              <span key={d}>
                {d}: <strong>{tooltipData.series[i]}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="sparkline-provenance">
        Updated {tagHistoryData._meta?.updateFrequency || "periodically"} · {dates.length} data
        points
      </div>
    </div>
  );
}

export default TagHistorySparkline;
