import React, { useMemo } from 'react';
import { useTagData } from '../../context/TagDataContext';
import './TagHeatmap.css';

/**
 * Tag Usage Heatmap
 * Shows tag usage intensity across categories
 * Darker = more courses using that tag
 */
function TagHeatmap() {
  const { tags, courses } = useTagData();

  // Build heatmap data grouped by category
  const heatmapData = useMemo(() => {
    // Group tags by their category (first part of tag ID)
    const categoryMap = new Map();
    
    tags.forEach(tag => {
      const category = tag.id.split('.')[0] || 'other';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category).push({
        id: tag.id,
        label: tag.label,
        count: tag.count || 0,
      });
    });

    // Sort categories and limit tags per category
    const categories = Array.from(categoryMap.entries())
      .map(([name, tagList]) => ({
        name,
        displayName: name.charAt(0).toUpperCase() + name.slice(1),
        tags: tagList.sort((a, b) => b.count - a.count).slice(0, 8), // Top 8 per category
      }))
      .filter(cat => cat.tags.length > 0)
      .sort((a, b) => {
        // Sort by total usage
        const totalA = a.tags.reduce((sum, t) => sum + t.count, 0);
        const totalB = b.tags.reduce((sum, t) => sum + t.count, 0);
        return totalB - totalA;
      })
      .slice(0, 6); // Top 6 categories

    // Find max count for color scaling
    const maxCount = Math.max(
      ...categories.flatMap(cat => cat.tags.map(t => t.count)),
      1
    );

    return { categories, maxCount, totalCourses: courses.length };
  }, [tags, courses]);

  const getHeatColor = (count, max) => {
    if (count === 0) return 'rgba(33, 38, 45, 0.8)';
    const intensity = count / max;
    if (intensity < 0.2) return 'rgba(88, 166, 255, 0.2)';
    if (intensity < 0.4) return 'rgba(88, 166, 255, 0.4)';
    if (intensity < 0.6) return 'rgba(88, 166, 255, 0.6)';
    if (intensity < 0.8) return 'rgba(88, 166, 255, 0.8)';
    return 'rgba(88, 166, 255, 1)';
  };

  return (
    <div className="tag-heatmap">
      <div className="heatmap-header">
        <h3>🏷️ Tag Usage Heatmap
          <span className="info-tooltip" title="Shows how frequently each tag appears in your course library. Darker cells indicate more courses use that tag. Tags are grouped by category and sorted by popularity.">ⓘ</span>
        </h3>
        <p className="heatmap-hint">Darker = more courses with this tag</p>
      </div>

      <div className="tag-heatmap-grid">
        {heatmapData.categories.map(category => (
          <div key={category.name} className="category-row">
            <div className="category-label">{category.displayName}</div>
            <div className="tag-cells">
              {category.tags.map(tag => (
                <div
                  key={tag.id}
                  className="tag-cell"
                  style={{ backgroundColor: getHeatColor(tag.count, heatmapData.maxCount) }}
                  title={`${tag.label}: ${tag.count} courses`}
                >
                  <span className="tag-name">{tag.label}</span>
                  <span className="tag-count">{tag.count}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Color Legend */}
      <div className="heatmap-legend">
        <span className="legend-label">0</span>
        <div className="legend-gradient" />
        <span className="legend-label">{heatmapData.maxCount}+</span>
      </div>
    </div>
  );
}

export default TagHeatmap;
