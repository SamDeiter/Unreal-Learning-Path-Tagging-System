/**
 * pathSearch.js — Stage 1: Hybrid Search (Vector + Keyword RAG)
 *
 * Finds relevant segments across:
 *   - Firestore vector embeddings (semantic similarity via Cloud Functions)
 *   - Local RAG database (75K+ keyword-matched segments from segment_index.json)
 *
 * Supports gap-specific dual-search for adaptive learning paths.
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";
import { recordTokenUsage } from "./tokenTracker";
import { retryWithBackoff } from "../utils/retryWithBackoff";
import { getSegmentIndex } from "./segmentSearchService";
import { SEARCH_STOPWORDS } from "../domain/constants";

// ── Constants ──────────────────────────────────────────────────────────
export const MAX_PATH_SEGMENTS = 8;
export const MIN_PATH_SEGMENTS = 3;

// Minimum cosine similarity for a segment to be considered a "good" match.
// Raised to 0.70 — rejects weak semantic matches (e.g., "time dilation" ≠ "delay nodes").
export const SIMILARITY_THRESHOLD = 0.7;

/**
 * Stage 1: Find relevant segments across all embedding collections.
 * Calls embedQuery → then vectorSearchSegments + vectorSearchEpic + vectorSearchDocs.
 *
 * When a knowledgeProfile with gaps is provided, a SECOND search is run using
 * only the gap terms. Results are merged (gap-sourced segments get a 1.5x boost)
 * so the sequencing stage has gap-relevant content to choose from.
 *
 * @param {string} userQuery - The user's natural language question
 * @param {number} topK - Results per collection (default 5)
 * @param {Object} [knowledgeProfile] - Optional adaptive profile { knows, gaps, level }
 * @returns {Promise<{segments: Array, embedding: number[], lowCorpusCoverage: boolean}>}
 */
export async function findRelevantSegments(userQuery, topK = 5, knowledgeProfile = null) {
  if (!userQuery?.trim()) return { segments: [], embedding: [] };

  const app = getFirebaseApp();
  const functions = getFunctions(app, "us-central1");

  // Helper: embed a query string and return the vector
  async function getEmbedding(query) {
    const embedFn = httpsCallable(functions, "embedQuery");
    const embedResult = await retryWithBackoff(() => embedFn({ query }), {
      maxRetries: 2,
      baseDelayMs: 1000,
      label: "embedQuery",
    });
    recordTokenUsage("embedQuery", Math.ceil(query.length / 4), 0);
    return embedResult.data?.embedding;
  }

  // Helper: run vector search across all 3 collections
  async function searchAllCollections(queryVector) {
    const [segResults, epicResults, docsResults] = await Promise.allSettled([
      httpsCallable(functions, "vectorSearchSegments")({ queryVector, topK }),
      httpsCallable(functions, "vectorSearchEpic")({ queryVector, topK }),
      httpsCallable(functions, "vectorSearchDocs")({ queryVector, topK }),
    ]);

    const segments = [];

    if (segResults.status === "fulfilled" && segResults.value?.data?.results) {
      for (const r of segResults.value.data.results) {
        segments.push({
          id: r.id,
          type: "transcript",
          courseCode: r.course_code,
          videoKey: r.video_key,
          videoTitle: r.video_title || "",
          startTimestamp: r.start_timestamp,
          endTimestamp: r.end_timestamp,
          startSeconds: r.start_seconds,
          text: r.text || "",
          similarity: r.similarity || 0,
        });
      }
    }

    if (epicResults.status === "fulfilled" && epicResults.value?.data?.results) {
      for (const r of epicResults.value.data.results) {
        segments.push({
          id: r.id,
          type: "epic_learning",
          title: r.title || "",
          url: r.url || "",
          contentType: r.content_type || "",
          author: r.author || "",
          text: r.text || "",
          similarity: r.similarity || 0,
        });
      }
    }

    if (docsResults.status === "fulfilled" && docsResults.value?.data?.results) {
      for (const r of docsResults.value.data.results) {
        segments.push({
          id: r.id,
          type: "docs",
          slug: r.slug || "",
          url: r.url || "",
          title: r.title || "",
          section: r.section || "",
          text: r.text || "",
          similarity: r.similarity || 0,
        });
      }
    }

    return segments;
  }

  // ── Local keyword RAG search ──────────────────────────────────────────
  // Searches the 75K+ segment_index.json for keyword matches.
  // Runs in parallel with vector search for zero added latency.
  async function localKeywordSearch(query) {
    try {
      const segmentIndex = await getSegmentIndex();
      if (!segmentIndex) return [];

      const keywords = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2 && !SEARCH_STOPWORDS.has(w));
      if (keywords.length === 0) return [];

      const results = [];

      for (const [courseKey, courseData] of Object.entries(segmentIndex)) {
        if (!courseData?.videos) continue;

        for (const [videoKey, videoData] of Object.entries(courseData.videos)) {
          if (!videoData?.segments) continue;

          for (const segment of videoData.segments) {
            const textLower = (segment.text || "").toLowerCase();
            let score = 0;
            const matched = [];

            for (const kw of keywords) {
              if (textLower.includes(kw)) {
                // Count occurrences
                const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
                const hits = (textLower.match(regex) || []).length;
                score += hits * 10;
                matched.push(kw);
              }
            }

            // Require at least 2 keyword matches or a high single-keyword score
            if (matched.length >= 2 || (matched.length === 1 && score >= 20)) {
              // Normalize score to 0-1 range (base 0.55, max 0.75)
              const normalizedSimilarity = Math.min(0.75, 0.55 + (score / 200));

              results.push({
                id: `rag_${courseKey}_${videoKey}_${results.length}`,
                type: "keyword_rag",
                courseCode: courseKey,
                videoKey: videoKey,
                videoTitle: videoData.title || videoKey,
                text: segment.text || "",
                similarity: normalizedSimilarity,
                matchedKeywords: matched,
                source: videoData.source || "local_rag",
              });
            }
          }
        }
      }

      // Sort by score, take top results
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, topK * 2);
      devLog(`[pathSearch] Local keyword RAG: ${results.length} matches, returning top ${topResults.length}`);
      return topResults;
    } catch (err) {
      devWarn("[pathSearch] Local keyword search failed (non-fatal):", err.message);
      return [];
    }
  }

  // ── Primary search: user's original query ──
  let queryVector;
  try {
    queryVector = await getEmbedding(userQuery);
    if (!queryVector) throw new Error("No embedding returned");
    devLog(`[BespokePath] Got ${queryVector.length}-dim embedding for query`);
  } catch (err) {
    devWarn("[BespokePath] embedQuery failed:", err.message);
    return { segments: [], embedding: [] };
  }

  const TRANSCRIPT_BOOST = 1.3;

  // Run vector search + local keyword search IN PARALLEL (zero added latency)
  const [vectorSegments, keywordSegments] = await Promise.all([
    searchAllCollections(queryVector),
    localKeywordSearch(userQuery),
  ]);

  let segments = [...vectorSegments, ...keywordSegments];
  devLog(`[pathSearch] Combined: ${vectorSegments.length} vector + ${keywordSegments.length} keyword RAG segments`);

  // ── Evaluate corpus quality from PRIMARY search only ──
  // This must happen BEFORE merging gap results, otherwise the gap boost
  // inflates scores and prevents hybrid fallback when the corpus actually
  // lacks content for the user's topic.
  const primaryBoosted = segments.map((seg) => ({
    ...seg,
    _score: seg.type === "transcript" ? seg.similarity * TRANSCRIPT_BOOST : seg.similarity,
  }));
  const primaryBest =
    primaryBoosted.length > 0 ? Math.max(...primaryBoosted.map((s) => s._score)) : 0;
  const lowCorpusCoverage = primaryBest < SIMILARITY_THRESHOLD;

  if (lowCorpusCoverage) {
    devWarn(
      `[BespokePath] Low corpus coverage: best primary similarity ${primaryBest.toFixed(3)} < ${SIMILARITY_THRESHOLD}`
    );
  }

  // ── Secondary search: gap-specific terms (only when adaptive) ──
  // This ensures the segment pool always contains gap-relevant content,
  // even when the user's phrasing doesn't semantically match the gap concepts.
  if (knowledgeProfile?.gaps?.length > 0) {
    const gapQuery = knowledgeProfile.gaps.map((g) => g.replace(/_/g, " ")).join(", ");
    devLog(`[BespokePath] Running gap-specific search: "${gapQuery}"`);

    try {
      const gapVector = await getEmbedding(gapQuery);
      if (gapVector) {
        const gapSegments = await searchAllCollections(gapVector);
        // Boost gap-sourced segments so they rank above generic query matches
        const GAP_BOOST = 1.5;
        for (const seg of gapSegments) {
          seg.similarity *= GAP_BOOST;
          seg._gapSourced = true;
        }
        devLog(`[BespokePath] Gap search returned ${gapSegments.length} segments`);
        segments = segments.concat(gapSegments);
      }
    } catch (err) {
      devWarn("[BespokePath] Gap-specific search failed (non-fatal):", err.message);
    }
  }

  // Deduplicate by id (keep the higher-similarity version)
  const segmentMap = new Map();
  for (const seg of segments) {
    const existing = segmentMap.get(seg.id);
    if (!existing || seg.similarity > existing.similarity) {
      segmentMap.set(seg.id, seg);
    }
  }
  segments = Array.from(segmentMap.values());

  // Boost transcript segments so video content ranks higher than articles
  for (const seg of segments) {
    if (seg.type === "transcript" && !seg._gapSourced) {
      seg.similarity *= TRANSCRIPT_BOOST;
    }
    // Construct YouTube URL with timestamp for direct linking
    if (seg.type === "transcript" && seg.videoKey) {
      const t = Math.floor(seg.startSeconds || 0);
      seg.videoUrl = `https://youtube.com/watch?v=${seg.videoKey}&t=${t}`;
      seg.thumbnailUrl = `https://img.youtube.com/vi/${seg.videoKey}/mqdefault.jpg`;
    }
  }

  // ── Junk Title Filter ──────────────────────────────────────────────
  // Reject segments with non-content titles (outros, credits, garbled IDs)
  const JUNK_TITLE_PATTERNS = [
    /^thank\s*you/i, // "Thank You 5.00"
    /^(intro|outro|credits?|end\s*card)/i, // non-content segments
    /^[A-Z]{1,3}\s+(GPT|LLM)\d/i, // garbled AI-ish titles
    /^\d+(\.\d+)?$/, // just a number
  ];
  const preFilterCount = segments.length;
  segments = segments.filter((seg) => {
    const title = (seg.title || seg.videoTitle || "").trim();
    // Reject if title is too short (garbled) — skip docs which may have no title
    if (seg.type === "transcript" && title.length > 0 && title.length < 5) return false;
    // Reject if title matches a junk pattern
    if (JUNK_TITLE_PATTERNS.some((p) => p.test(title))) {
      devLog(`[pathSearch] Filtered junk segment: "${title}"`);
      return false;
    }
    // Reject UE4 / Unreal Engine 4 content — this LMS is UE5-only
    const fullText = `${title} ${seg.text || ""}`.toLowerCase();
    if (/\bue\s*4\b/.test(fullText) || /\bunreal\s+engine\s+4\b/.test(fullText)) {
      devLog(`[pathSearch] Filtered UE4 segment: "${title}"`);
      return false;
    }
    return true;
  });
  if (segments.length < preFilterCount) {
    devLog(`[pathSearch] Junk filter removed ${preFilterCount - segments.length} segment(s)`);
  }

  // Sort by similarity, take top results
  segments.sort((a, b) => b.similarity - a.similarity);

  const topSegments = segments.slice(0, topK * 3);

  devLog(
    `[BespokePath] Found ${topSegments.length} segments (primaryBest: ${primaryBest.toFixed(3)}, lowCoverage: ${lowCorpusCoverage})`
  );

  return { segments: topSegments, embedding: queryVector, lowCorpusCoverage };
}
