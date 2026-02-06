/**
 * Segment Search Service - Find exact moments in video transcripts
 * Uses VTT files in content/transcripts/ to locate specific topics
 */

// Pre-built search index (word frequencies by course)
import searchIndex from "../data/search_index.json";

/**
 * Search for segments mentioning specific keywords
 * @param {string} query - Search query (e.g., "lumen flickering GI")
 * @param {Array} courses - Optional array of course objects to search within
 * @returns {Array} Matched segments with timestamps
 */
export function searchSegments(query, courses = []) {
  if (!query || query.length < 3) return [];

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (keywords.length === 0) return [];

  const results = [];
  const courseWords = searchIndex?.course_words || {};

  // Score each course by keyword matches
  for (const [courseCode, wordFreq] of Object.entries(courseWords)) {
    let score = 0;
    const matchedKeywords = [];

    for (const keyword of keywords) {
      // Check exact match
      if (wordFreq[keyword]) {
        score += wordFreq[keyword] * 10;
        matchedKeywords.push(keyword);
      }
      // Check partial matches
      for (const [word, count] of Object.entries(wordFreq)) {
        if (word.includes(keyword) || keyword.includes(word)) {
          score += count * 5;
          if (!matchedKeywords.includes(word)) {
            matchedKeywords.push(word);
          }
        }
      }
    }

    if (score > 0 && matchedKeywords.length > 0) {
      // Find the course object if provided
      const course = courses.find((c) => c.code === courseCode);

      results.push({
        courseCode,
        courseTitle: course?.title || courseCode,
        score,
        matchedKeywords,
        // Estimate top segment based on keyword density
        estimatedSegment: estimateTopSegment(courseCode, matchedKeywords),
        videoCount: course?.video_count || 0,
        duration: course?.duration_formatted || "Unknown",
      });
    }
  }

  // Sort by score descending, take top 5
  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * Estimate the top segment for a course based on keywords
 * In production, this would parse VTT files for exact timestamps
 */
function estimateTopSegment(courseCode, keywords) {
  // For MVP, return estimated segment info
  // Full implementation would parse VTT files from content/transcripts/
  return {
    videoNumber: 1,
    estimatedTimestamp: "0:00",
    previewText: `Discusses ${keywords.slice(0, 3).join(", ")}...`,
    segmentDuration: "5-10 min",
  };
}

/**
 * Get top courses matching a problem query
 * Returns fewer, more targeted results than matchCoursesToCart
 * @param {string} problemQuery - User's problem description
 * @param {Array} allCourses - All available courses
 * @returns {Array} Top 3-5 targeted course segments
 */
export function getTargetedSegments(problemQuery, allCourses) {
  const segments = searchSegments(problemQuery, allCourses);

  return segments.map((seg, index) => ({
    ...seg,
    priority: index + 1,
    watchNow: index === 0,
    ctaLabel: index === 0 ? "▶ Watch Now" : "Watch Next",
  }));
}

/**
 * Format segment for display in hero card
 */
export function formatSegmentCard(segment) {
  return {
    title: segment.estimatedSegment?.previewText || segment.courseTitle,
    timestamp: segment.estimatedSegment?.estimatedTimestamp || "0:00",
    duration: segment.estimatedSegment?.segmentDuration || segment.duration,
    courseCode: segment.courseCode,
    score: segment.score,
    cta: segment.ctaLabel || "Watch",
  };
}

export default {
  searchSegments,
  getTargetedSegments,
  formatSegmentCard,
};
