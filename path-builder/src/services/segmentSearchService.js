/**
 * Segment Search Service - Find exact moments in video transcripts
 * Supports both keyword search (TF scoring) and semantic search (Firestore vector KNN).
 *
 * Keyword search: uses search_index.json + segment_index.json (local)
 * Semantic search: vectorSearchSegments + vectorSearchEpic Cloud Functions (Firestore)
 */

// Lazy-loaded data — fetched from public/data/ at runtime
import { fetchJSON } from "./dataLoader";

let _searchIndex = null;
let _segmentIndex = null;

/** Lazily load search_index.json (~4.7MB) from public/data/. */
async function getSearchIndex() {
  if (!_searchIndex) {
    _searchIndex = await fetchJSON("search_index");
  }
  return _searchIndex;
}

/** Lazily load segment_index.json (~9MB) from public/data/. */
export async function getSegmentIndex() {
  if (!_segmentIndex) {
    _segmentIndex = await fetchJSON("segment_index");
  }
  return _segmentIndex;
}
import { devLog, devWarn } from "../utils/logger";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";

import { SEARCH_STOPWORDS } from "../domain/constants";

/**
 * Search for segments mentioning specific keywords
 * @param {string} query - Search query (e.g., "lumen flickering GI")
 * @param {Array} courses - Optional array of course objects to search within
 * @returns {Array} Matched segments with timestamps
 */
// Cached prefix index for fast prefix/stem matching
let _prefixIndex = null;

/**
 * Build a prefix index from courseWords for O(1) prefix lookups.
 * Maps 4-char prefixes → [{courseCode, word, count}].
 * @param {Object} courseWords - { courseCode: { word: count } }
 */
function buildPrefixIndex(courseWords) {
  const index = new Map();
  for (const [courseCode, wordFreq] of Object.entries(courseWords)) {
    for (const [word, count] of Object.entries(wordFreq)) {
      if (word.length >= 4) {
        const prefix = word.slice(0, 4);
        if (!index.has(prefix)) {
          index.set(prefix, []);
        }
        index.get(prefix).push({ courseCode, word, count });
      }
    }
  }
  return index;
}

export async function searchSegments(query, courses = []) {
  if (!query || query.length < 3) return [];

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SEARCH_STOPWORDS.has(w));
  if (keywords.length === 0) return [];

  const searchIndex = await getSearchIndex();
  const courseWords = searchIndex?.course_words || {};

  // Build prefix index on first use (cached for subsequent calls)
  if (!_prefixIndex) {
    _prefixIndex = buildPrefixIndex(courseWords);
  }

  // Score each course by keyword matches
  const courseScores = new Map(); // courseCode → { score, matchedKeywords }

  for (const keyword of keywords) {
    // Exact matches across all courses
    for (const [courseCode, wordFreq] of Object.entries(courseWords)) {
      if (wordFreq[keyword]) {
        if (!courseScores.has(courseCode)) {
          courseScores.set(courseCode, { score: 0, matchedKeywords: [] });
        }
        const entry = courseScores.get(courseCode);
        // Exact match weight: 10x frequency to strongly prefer direct keyword hits
        entry.score += wordFreq[keyword] * 10;
        if (!entry.matchedKeywords.includes(keyword)) {
          entry.matchedKeywords.push(keyword);
        }
      }
    }

    // Prefix matches via index — O(1) lookup instead of O(m) scan
    if (keyword.length >= 4) {
      const prefix = keyword.slice(0, 4);
      const matches = _prefixIndex.get(prefix) || [];
      for (const { courseCode, word, count } of matches) {
        if (
          word !== keyword &&
          (word.startsWith(keyword) || keyword.startsWith(word))
        ) {
          if (!courseScores.has(courseCode)) {
            courseScores.set(courseCode, { score: 0, matchedKeywords: [] });
          }
          const entry = courseScores.get(courseCode);
          // Prefix match weight: 3x frequency (weaker than exact match 10x)
          entry.score += count * 3;
          if (!entry.matchedKeywords.includes(word)) {
            entry.matchedKeywords.push(word);
          }
        }
      }
    }
  }

  const results = [];
  for (const [courseCode, { score, matchedKeywords }] of courseScores) {
    if (score >= 30 && matchedKeywords.length > 0) {
      const course = courses.find((c) => c.code === courseCode);
      const topSegments = await findTopSegments(courseCode, matchedKeywords);

      results.push({
        courseCode,
        courseTitle: course?.title || courseCode,
        score,
        matchedKeywords,
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
export async function findTopSegments(courseCode, keywords) {
  const segmentIndex = await getSegmentIndex();
  const courseData = segmentIndex[courseCode];
  if (!courseData || !courseData.videos) return [];

  const scoredSegments = [];

  // ⚡ Bolt Optimization: Pre-compile regexes once for all segments
  const keywordMatchers = keywords.map((kw) => {
    const kwLower = kw.toLowerCase();
    return {
      kw,
      kwLower,
      regex: new RegExp(kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
    };
  });

  for (const [videoKey, videoData] of Object.entries(courseData.videos)) {
    if (!videoData.segments) continue;

    for (const segment of videoData.segments) {
      const textLower = segment.text.toLowerCase();
      let segScore = 0;
      const matched = [];

      for (const { kw, kwLower, regex } of keywordMatchers) {
        // Count occurrences of keyword in segment text
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
 * Get top courses matching a problem query
 * Returns fewer, more targeted results than matchCoursesToCart
 * @param {string} problemQuery - User's problem description
 * @param {Array} allCourses - All available courses
 * @returns {Array} Top 3-5 targeted course segments
 */
export async function getTargetedSegments(problemQuery, allCourses) {
  const segments = await searchSegments(problemQuery, allCourses);

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

/**
 * Semantic segment search using Firestore vector KNN.
 * Calls vectorSearchSegments + vectorSearchEpic Cloud Functions.
 *
 * @param {number[]|Float32Array} queryEmbedding - Query vector from embedQuery Cloud Function
 * @param {number} topK - Number of results (default 10)
 * @param {number} threshold - Minimum similarity (default 0.35) — unused, server handles ranking
 * @returns {Promise<Array<{id, courseCode, videoKey, videoTitle, timestamp, startSeconds, text, similarity}>>}
 */
export async function searchSegmentsSemantic(queryEmbedding, topK = 10, _threshold = 0.35) {
  if (!queryEmbedding) return [];

  const queryVector = Array.isArray(queryEmbedding) ? queryEmbedding : Array.from(queryEmbedding);

  const app = getFirebaseApp();
  const functions = getFunctions(app, "us-central1");

  const results = [];

  // Search segment embeddings (video transcripts) via Cloud Function
  try {
    const segmentSearchFn = httpsCallable(functions, "vectorSearchSegments");
    const segResult = await segmentSearchFn({ queryVector, topK });

    if (segResult.data?.results) {
      for (const r of segResult.data.results) {
        results.push({
          id: r.id,
          courseCode: r.course_code || null,
          videoKey: r.video_key || null,
          videoTitle: r.video_title || "",
          timestamp: r.start_timestamp || null,
          endTimestamp: r.end_timestamp || null,
          startSeconds: r.start_seconds || null,
          previewText: r.text || "",
          similarity: r.similarity || 0,
          source: "transcript",
        });
      }
    }
  } catch (err) {
    devWarn("[SegmentSearch] vectorSearchSegments failed:", err.message);
  }

  // Search Epic Learning embeddings (articles, tutorials, talks) via Cloud Function
  try {
    const epicSearchFn = httpsCallable(functions, "vectorSearchEpic");
    const epicResult = await epicSearchFn({ queryVector, topK });

    if (epicResult.data?.results) {
      for (const r of epicResult.data.results) {
        results.push({
          id: r.id,
          courseCode: null,
          videoKey: null,
          videoTitle: r.title || "",
          timestamp: null,
          endTimestamp: null,
          startSeconds: null,
          previewText: r.text || "",
          similarity: r.similarity || 0,
          source: "epic_learning",
          // Epic-specific fields
          epicUrl: r.url || null,
          epicContentType: r.content_type || null,
          epicAuthor: r.author || null,
          epicTags: r.tags || [],
          epicHashId: r.hash_id || null,
        });
      }
    }
  } catch (err) {
    devWarn("[SegmentSearch] vectorSearchEpic failed:", err.message);
  }

  if (results.length === 0) {
    devWarn("[SegmentSearch] Semantic search returned no results");
  }

  results.sort((a, b) => b.similarity - a.similarity);
  devLog(`[SegmentSearch] Found ${results.length} semantic results via Firestore KNN`);
  return results.slice(0, topK);
}

/**
 * Hybrid search: combines keyword results with semantic results.
 * Deduplicates by courseCode + videoKey, preferring semantic scores.
 *
 * @param {string} query - User's text query
 * @param {number[]|Float32Array|null} queryEmbedding - Optional 768-dim vector
 * @param {Array} courses - Course objects for metadata
 * @param {number} topK - Max results (default 8)
 * @returns {Promise<Array>}
 */
export async function searchSegmentsHybrid(query, queryEmbedding, courses = [], topK = 8) {
  // Run both searches
  const keywordResults = await searchSegments(query, courses);
  let semanticResults = [];

  if (queryEmbedding) {
    semanticResults = await searchSegmentsSemantic(queryEmbedding, topK, 0.35);
  }

  // Merge: deduplicate by segment key, keeping the higher-scoring entry
  const bestByKey = new Map(); // key → entry

  // Add semantic results (passage-level)
  for (const seg of semanticResults) {
    const key = `${seg.courseCode}:${seg.videoKey}:${seg.timestamp}`;
    const entry = {
      ...seg,
      searchType: "semantic",
      score: Math.round(seg.similarity * 100),
    };
    const existing = bestByKey.get(key);
    if (!existing || entry.score > existing.score) {
      bestByKey.set(key, entry);
    }
  }

  // Add keyword results, replacing if score is higher
  for (const kw of keywordResults) {
    for (const topSeg of kw.topSegments || []) {
      const key = `${kw.courseCode}:${topSeg.videoKey}:${topSeg.timestamp}`;
      const entry = {
        id: `kw_${kw.courseCode}_${topSeg.videoKey}`,
        courseCode: kw.courseCode,
        videoKey: topSeg.videoKey,
        videoTitle: topSeg.videoTitle,
        timestamp: topSeg.timestamp,
        startSeconds: topSeg.startSeconds,
        previewText: topSeg.previewText,
        similarity: 0,
        score: topSeg.score,
        searchType: "keyword",
        source: "transcript",
      };
      const existing = bestByKey.get(key);
      if (!existing || entry.score > existing.score) {
        bestByKey.set(key, entry);
      }
    }
  }

  const merged = Array.from(bestByKey.values());
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, topK);
}

export default {
  searchSegments,
  findTopSegments,
  getTargetedSegments,
  formatSegmentCard,
  searchSegmentsSemantic,
  searchSegmentsHybrid,
};
