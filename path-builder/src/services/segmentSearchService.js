/**
 * Segment Search Service - Find exact moments in video transcripts
 * Uses pre-built segment index from VTT files to locate specific topics
 */

// Pre-built search index (word frequencies by course)
import searchIndex from "../data/search_index.json";
// Pre-built segment index (real timestamps from VTT transcripts)
import segmentIndex from "../data/segment_index.json";

// Common transcript words that appear in nearly every course and add no signal
const SEARCH_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "are",
  "was",
  "has",
  "have",
  "not",
  "can",
  "into",
  "from",
  "how",
  "you",
  "your",
  "will",
  "would",
  "also",
  "just",
  "like",
  "more",
  "very",
  "some",
  "want",
  "need",
  "make",
  "use",
  "used",
  "using",
  "help",
  "helpful",
  "helps",
  "get",
  "getting",
  "let",
  "look",
  "going",
  "come",
  "here",
  "there",
  "know",
  "thing",
  "really",
  "actually",
  "basically",
  "something",
  "everything",
  "slow",
  "fast",
  "leading",
  "exhibiting",
  "experiencing",
  "causing",
  "about",
  "been",
  "being",
  "could",
  "does",
  "doing",
  "done",
  "each",
  "even",
  "every",
  "first",
  "give",
  "good",
  "great",
  "kind",
  "made",
  "much",
  "over",
  "part",
  "right",
  "same",
  "see",
  "show",
  "start",
  "still",
  "take",
  "tell",
  "than",
  "them",
  "then",
  "these",
  "they",
  "those",
  "through",
  "time",
  "took",
  "turn",
  "way",
  "well",
  "what",
  "when",
  "where",
  "which",
  "while",
  "work",
  "working",
]);

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
    .filter((w) => w.length > 2 && !SEARCH_STOPWORDS.has(w));
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
      // Check prefix/stem matches (must share 4+ char prefix)
      if (keyword.length >= 4) {
        for (const [word, count] of Object.entries(wordFreq)) {
          if (
            word !== keyword &&
            word.length >= 4 &&
            (word.startsWith(keyword) || keyword.startsWith(word))
          ) {
            score += count * 3;
            if (!matchedKeywords.includes(word)) {
              matchedKeywords.push(word);
            }
          }
        }
      }
    }

    if (score >= 30 && matchedKeywords.length > 0) {
      // Find the course object if provided
      const course = courses.find((c) => c.code === courseCode);

      // Find real segments with timestamps
      const topSegments = findTopSegments(courseCode, matchedKeywords);

      results.push({
        courseCode,
        courseTitle: course?.title || courseCode,
        score,
        matchedKeywords,
        // Real segment data from VTT transcripts
        topSegments,
        estimatedSegment: topSegments.length > 0 ? topSegments[0] : null,
        videoCount: course?.video_count || 0,
        duration: course?.duration_formatted || "Unknown",
      });
    }
  }

  // Sort by score descending, take top 5
  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * Find the top segments in a course that match the given keywords.
 * Searches through the pre-built segment index for real timestamps.
 *
 * @param {string} courseCode - The course code (e.g., "102.03")
 * @param {Array<string>} keywords - Keywords to search for
 * @returns {Array} Top 3 segments with timestamps and preview text
 */
export function findTopSegments(courseCode, keywords) {
  const courseData = segmentIndex[courseCode];
  if (!courseData || !courseData.videos) return [];

  const scoredSegments = [];

  for (const [videoKey, videoData] of Object.entries(courseData.videos)) {
    if (!videoData.segments) continue;

    for (const segment of videoData.segments) {
      const textLower = segment.text.toLowerCase();
      let segScore = 0;
      const matched = [];

      for (const kw of keywords) {
        const kwLower = kw.toLowerCase();
        // Count occurrences of keyword in segment text
        const regex = new RegExp(kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const matches = textLower.match(regex);
        if (matches) {
          segScore += matches.length * 10;
          matched.push(kw);
        }
        // Partial match bonus
        if (textLower.includes(kwLower)) {
          segScore += 5;
          if (!matched.includes(kw)) matched.push(kw);
        }
      }

      if (segScore > 0) {
        // Truncate preview text to ~120 chars
        let preview = segment.text;
        if (preview.length > 120) {
          // Try to find the first keyword occurrence and center around it
          const firstKw = matched[0] || "";
          const idx = preview.toLowerCase().indexOf(firstKw.toLowerCase());
          if (idx > 40) {
            preview = "..." + preview.substring(idx - 30);
          }
          if (preview.length > 120) {
            preview = preview.substring(0, 117) + "...";
          }
        }

        scoredSegments.push({
          videoKey,
          videoTitle: videoData.title,
          timestamp: segment.start,
          startSeconds: segment.start_seconds,
          endTimestamp: segment.end,
          previewText: preview,
          matchedKeywords: matched,
          score: segScore,
        });
      }
    }
  }

  // Sort by score and return top 3
  return scoredSegments.sort((a, b) => b.score - a.score).slice(0, 3);
}

/**
 * Legacy compatibility — now wraps findTopSegments
 */
export function estimateTopSegment(courseCode, keywords) {
  const segments = findTopSegments(courseCode, keywords);
  if (segments.length > 0) {
    return {
      videoNumber: 1,
      estimatedTimestamp: segments[0].timestamp,
      previewText: segments[0].previewText,
      segmentDuration: "~30s",
      videoTitle: segments[0].videoTitle,
      startSeconds: segments[0].startSeconds,
    };
  }
  // Fallback if no segments found
  return {
    videoNumber: 1,
    estimatedTimestamp: "0:00",
    previewText: `Discusses ${keywords.slice(0, 3).join(", ")}...`,
    segmentDuration: "Unknown",
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
    timestamp:
      segment.estimatedSegment?.estimatedTimestamp || segment.estimatedSegment?.timestamp || "0:00",
    duration: segment.estimatedSegment?.segmentDuration || segment.duration,
    courseCode: segment.courseCode,
    score: segment.score,
    cta: segment.ctaLabel || "Watch",
    topSegments: segment.topSegments || [],
  };
}

export default {
  searchSegments,
  findTopSegments,
  getTargetedSegments,
  formatSegmentCard,
};
