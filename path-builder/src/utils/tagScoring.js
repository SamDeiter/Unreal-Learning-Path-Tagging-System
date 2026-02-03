/**
 * Tag Quality Scoring
 * 
 * Scores tags based on frequency and specificity to filter out noise.
 * Higher scores = more useful tags
 */

/**
 * Calculate tag quality score
 * Score = frequency × log(1/commonality)
 * 
 * @param {number} count - How often this tag appears
 * @param {number} totalCourses - Total courses in library
 * @param {number} coursesWithTag - How many courses have this tag
 * @returns {number} Quality score (higher = better)
 */
export function calculateTagScore(count, totalCourses, coursesWithTag) {
  // Specificity: inverse document frequency
  const specificity = Math.log((totalCourses + 1) / (coursesWithTag + 1));
  
  // Frequency bonus (diminishing returns)
  const frequencyBonus = Math.log(count + 1);
  
  return specificity * frequencyBonus;
}

/**
 * Score all tags and filter by quality threshold
 * 
 * @param {Object} tagCounts - Map of tag -> count
 * @param {number} totalCourses - Total courses
 * @param {Object} tagCourseCounts - Map of tag -> number of courses with tag
 * @param {number} threshold - Minimum score to include
 * @returns {Array} [{ tag, count, score, passed }] sorted by score
 */
export function scoreAndFilterTags(tagCounts, totalCourses, tagCourseCounts, threshold = 1.0) {
  const scored = Object.entries(tagCounts).map(([tag, count]) => {
    const coursesWithTag = tagCourseCounts[tag] || 1;
    const score = calculateTagScore(count, totalCourses, coursesWithTag);
    
    return {
      tag,
      count,
      coursesWithTag,
      score: Math.round(score * 100) / 100,
      passed: score >= threshold
    };
  });
  
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Get high-quality tags only (above threshold)
 */
export function getQualityTags(tagCounts, totalCourses, tagCourseCounts, threshold = 1.0) {
  const scored = scoreAndFilterTags(tagCounts, totalCourses, tagCourseCounts, threshold);
  return scored.filter(t => t.passed);
}

/**
 * Trust levels for different tag sources
 */
export const SOURCE_TRUST = {
  BASE: 1.0,   // Manual taxonomy - fully trusted
  AI: 0.8,    // Gemini enriched - high trust
  VIDEO: 0.6  // Auto-extracted - moderate trust
};

/**
 * Apply trust weighting to tag score
 */
export function applyTrustWeight(score, source) {
  return score * (SOURCE_TRUST[source] || 0.5);
}

/**
 * Default quality thresholds
 */
export const QUALITY_THRESHOLDS = {
  AUTOCOMPLETE: 1.5,  // Higher bar for suggestions
  DISPLAY: 1.0,       // Standard display
  ANALYTICS: 0.5      // Include more for analysis
};
