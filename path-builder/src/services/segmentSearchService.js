/**
 * Segment Search Service - Find exact moments in video transcripts
 * Supports both keyword search (TF scoring) and semantic search (cosine similarity).
 *
 * Keyword search: uses search_index.json + segment_index.json
 * Semantic search: uses segment_embeddings.json (pre-computed 768-dim vectors)
 */

// Lazy-loaded data (deferred from initial bundle)
let _searchIndex = null;
let _segmentIndex = null;

/** Lazily load search_index.json (4.7MB). */
async function getSearchIndex() {
  if (!_searchIndex) {
    const mod = await import("../data/search_index.json");
    _searchIndex = mod.default || mod;
  }
  return _searchIndex;
}

/** Lazily load segment_index.json (3.7MB). */
export async function getSegmentIndex() {
  if (!_segmentIndex) {
    const mod = await import("../data/segment_index.json");
    _segmentIndex = mod.default || mod;
  }
  return _segmentIndex;
}
import { cosineSimilarity } from "./semanticSearchService";

import { devLog, devWarn } from "../utils/logger";

import { decodeFloat16Vector } from "../utils/float16";

// Lazy-loaded embeddings (5.9MB, loaded on first semantic query)
let _segmentEmbeddings = null;
let _decodedVectors = null;

/**
 * Lazily load and decode segment embeddings.
 * Only loaded on first semantic search call.
 * @returns {Promise<Map<string, {vector: Float32Array, meta: Object}>>}
 */
async function getSegmentEmbeddings() {
  if (_decodedVectors) return _decodedVectors;

  if (!_segmentEmbeddings) {
    try {
      // Use fetch() instead of import() — Vite resolves import() at build time,
      // which fails in CI where this optional file doesn't exist.
      const resp = await fetch(new URL("../data/segment_embeddings.json", import.meta.url));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      _segmentEmbeddings = await resp.json();
    } catch (err) {
      devWarn("⚠️ segment_embeddings.json not available:", err.message);
      return null;
    }
  }

  const segments = _segmentEmbeddings?.segments;
  if (!segments) return null;

  // Decode all vectors once
  _decodedVectors = new Map();
  for (const [id, seg] of Object.entries(segments)) {
    _decodedVectors.set(id, {
      vector: decodeFloat16Vector(seg.embedding),
      courseCode: seg.course_code,
      videoKey: seg.video_key,
      videoTitle: seg.video_title,
      startTimestamp: seg.start_timestamp,
      endTimestamp: seg.end_timestamp,
      startSeconds: seg.start_seconds,
      text: seg.text,
      tokenEstimate: seg.token_estimate,
    });
  }

  devLog(`[SegmentSearch] Decoded ${_decodedVectors.size} segment embeddings`);
  return _decodedVectors;
}

import { SEARCH_STOPWORDS } from "../domain/constants";

/**
 * Search for segments mentioning specific keywords
 * @param {string} query - Search query (e.g., "lumen flickering GI")
 * @param {Array} courses - Optional array of course objects to search within
 * @returns {Array} Matched segments with timestamps
 */
export async function searchSegments(query, courses = []) {
  if (!query || query.length < 3) return [];

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SEARCH_STOPWORDS.has(w));
  if (keywords.length === 0) return [];

  const searchIndex = await getSearchIndex();
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
      const topSegments = await findTopSegments(courseCode, matchedKeywords);

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
export async function findTopSegments(courseCode, keywords) {
  const segmentIndex = await getSegmentIndex();
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
 * Semantic segment search using pre-computed embeddings.
 * Finds segments closest to the query embedding via cosine similarity.
 *
 * @param {number[]|Float32Array} queryEmbedding - 768-dim query vector (from embedQuery Cloud Function)
 * @param {number} topK - Number of results (default 10)
 * @param {number} threshold - Minimum similarity (default 0.35)
 * @returns {Promise<Array<{id, courseCode, videoKey, videoTitle, timestamp, startSeconds, text, similarity}>>}
 */
export async function searchSegmentsSemantic(queryEmbedding, topK = 10, threshold = 0.35) {
  if (!queryEmbedding) return [];

  const embeddings = await getSegmentEmbeddings();
  if (!embeddings) {
    devWarn("[SegmentSearch] Semantic search unavailable — no embeddings loaded");
    return [];
  }

  const results = [];
  for (const [id, seg] of embeddings) {
    const similarity = cosineSimilarity(queryEmbedding, seg.vector);
    if (similarity >= threshold) {
      results.push({
        id,
        courseCode: seg.courseCode,
        videoKey: seg.videoKey,
        videoTitle: seg.videoTitle,
        timestamp: seg.startTimestamp,
        endTimestamp: seg.endTimestamp,
        startSeconds: seg.startSeconds,
        previewText: seg.text,
        similarity,
        source: "transcript",
      });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  const top = results.slice(0, topK);

  // ── Chunk overlap: bleed 1 sentence from adjacent segments ──
  // Build a lookup of segments grouped by courseCode:videoKey for neighbor access
  if (top.length > 0) {
    const videoSegments = new Map(); // key = courseCode:videoKey, value = sorted [{ id, text, startSeconds }]
    for (const [id, seg] of embeddings) {
      const vk = `${seg.courseCode}:${seg.videoKey}`;
      if (!videoSegments.has(vk)) videoSegments.set(vk, []);
      videoSegments.get(vk).push({ id, text: seg.text, startSeconds: seg.startSeconds });
    }
    // Sort each video's segments by start time
    for (const segs of videoSegments.values()) {
      segs.sort((a, b) => a.startSeconds - b.startSeconds);
    }

    for (const result of top) {
      const vk = `${result.courseCode}:${result.videoKey}`;
      const segs = videoSegments.get(vk);
      if (!segs) continue;
      const idx = segs.findIndex((s) => s.id === result.id);
      if (idx === -1) continue;

      // Grab trailing sentence from previous segment
      let contextBefore = "";
      if (idx > 0) {
        const prevText = segs[idx - 1].text || "";
        const sentences = prevText.split(/[.!?]+\s*/);
        contextBefore = sentences[sentences.length - 1]?.trim() || "";
      }
      // Grab leading sentence from next segment
      let contextAfter = "";
      if (idx < segs.length - 1) {
        const nextText = segs[idx + 1].text || "";
        const sentences = nextText.split(/[.!?]+\s*/);
        contextAfter = sentences[0]?.trim() || "";
      }

      // Enrich previewText with context bleed
      if (contextBefore || contextAfter) {
        const parts = [];
        if (contextBefore) parts.push("..." + contextBefore);
        parts.push(result.previewText);
        if (contextAfter) parts.push(contextAfter + "...");
        result.previewText = parts.join(" ");
      }
    }
  }

  return top;
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

  // Semantic results are passage-level, keyword results are course-level
  // Merge: semantic passages first, then keyword courses as fallback
  const seen = new Set();
  const merged = [];

  // Add semantic results (higher priority — passage-level)
  for (const seg of semanticResults) {
    const key = `${seg.courseCode}:${seg.videoKey}:${seg.timestamp}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        ...seg,
        searchType: "semantic",
        score: Math.round(seg.similarity * 100),
      });
    }
  }

  // Add keyword results that weren't already covered
  for (const kw of keywordResults) {
    for (const topSeg of kw.topSegments || []) {
      const key = `${kw.courseCode}:${topSeg.videoKey}:${topSeg.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({
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
        });
      }
    }
  }

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
