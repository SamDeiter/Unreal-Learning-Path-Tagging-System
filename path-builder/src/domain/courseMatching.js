/**
 * Course Matching Domain — Pure functions for matching courses to user queries.
 * No React, no side effects, easily testable.
 */
import tagGraphService from "../services/TagGraphService";
import { searchSegments } from "../services/segmentSearchService";
import synonymMap from "../data/synonym_map.json";
import curatedSolutions from "../data/curated_solutions.json";

import { devLog } from "../utils/logger";

// Tiered matching threshold — semantic search only fires when
// deterministic passes score below this value
const TIER1_CONFIDENCE_THRESHOLD = 60;

// UE5-only tag prefixes (engine_versions.min >= "5.0" in tags.json)
const UE5_ONLY_TAGS = new Set([
  "rendering.lumen",
  "rendering.nanite",
  "rendering.virtualShadowMaps",
  "rendering.substrate",
  "worldbuilding.worldPartition",
]);

import { SEARCH_STOPWORDS as STOPWORDS } from "./constants";

/** Check if a course has any playable/viewable content (Drive video, YouTube, or Doc URL) */
function isPlayable(course) {
  if (course.videos?.length && course.videos[0]?.drive_id) return true;
  if (course.source === 'youtube' && course.youtube_url) return true;
  if (course.source === 'epic_docs') return true;
  return false;
}

/**
 * Detect UE version intent from user query.
 * @returns {number|null} 4, 5, or null (no version specified)
 */
export function detectUEVersion(query) {
  const q = (query || "").toLowerCase();
  if (/\bue\s*5\b|\bunreal\s*engine\s*5\b|\b5\.\d\b/.test(q)) return 5;
  if (/\bue\s*4\b|\bunreal\s*engine\s*4\b|\b4\.\d{1,2}\b/.test(q)) return 4;
  return null;
}

/**
 * Match courses to the cart based on TRANSCRIPT content (not just tags)
 * Uses a multi-pass strategy:
 *   Pass 1: Search with the user's raw query (highest relevancy)
 *   Pass 2: Title/tag/description + synonym expansion
 *   Pass 2.5: Semantic search (tier 2 fallback)
 *   Pass 3: Broaden with AI diagnosis terms
 *   Fallback: Tag graph scoring
 */
export async function matchCoursesToCart(
  cart,
  allCourses,
  selectedTagIds = [],
  errorLog = "",
  semanticResults = [],
  boostMap = null
) {
  if (!allCourses || allCourses.length === 0) return [];

  const userQuery = cart?.userQuery || "";

  // --- Curated Solutions (Priority 0 check) ---
  const queryLowerFull = userQuery.toLowerCase();
  for (const solution of curatedSolutions) {
    const matched = solution.patterns.some((p) => queryLowerFull.includes(p));
    if (matched) {
      const curatedCourses = solution.courses
        .map((code) => {
          const course = allCourses.find((c) => c.code === code);
          if (!course || !isPlayable(course)) return null;
          return {
            ...course,
            _relevanceScore: 200,
            _curatedMatch: true,
            _curatedExplanation: solution.explanation,
          };
        })
        .filter(Boolean);
      if (curatedCourses.length > 0) {
        devLog("✅ Curated solution match:", solution.explanation);
        return curatedCourses;
      }
    }
  }

  // --- Error Signature Integration ---
  const combinedErrorText = `${userQuery} ${errorLog}`.trim();
  const signatureMatches = tagGraphService.matchErrorSignature(combinedErrorText);
  const autoDetectedTagIds = signatureMatches.map((m) => m.tag.tag_id);
  const mergedTagIds = [...new Set([...selectedTagIds, ...autoDetectedTagIds])];

  if (signatureMatches.length > 0) {
    devLog(
      "🔍 Error signatures detected:",
      signatureMatches.map((m) => `${m.tag.display_name} (${m.matchedSignature}, ${m.confidence})`)
    );
  }

  // --- Tag Taxonomy Boost (Pass 0.5) ---
  // Resolve query to canonical tags via synonym rings (e.g. "nanite" → rendering.nanite)
  const taxonomyResult = tagGraphService.extractTagsFromText(userQuery);
  const taxonomyTagIds = taxonomyResult.matchedTagIds || [];
  if (taxonomyTagIds.length > 0) {
    devLog("🏷️ Tag taxonomy matches:", taxonomyResult.matches.map(
      (m) => `${m.tagId} (via "${m.matchedTerm}", ${m.matchType})`
    ));
    // Merge into tag boost pool so applyTagBoost also benefits
    for (const tid of taxonomyTagIds) {
      if (!mergedTagIds.includes(tid)) mergedTagIds.push(tid);
    }
  }

  // Extract extra keywords from error log
  const errorKeywords = errorLog
    .toLowerCase()
    .split(/[\s\n:;,()[\]{}]+/)
    .filter((w) => w.length > 3 && !/^[0-9]+$/.test(w))
    .slice(0, 10);

  // Extract + expand keywords
  const rawKeywords = userQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const expandedKeywords = new Set(rawKeywords);
  const queryLower = userQuery.toLowerCase();
  for (const [term, synonyms] of Object.entries(synonymMap)) {
    if (queryLower.includes(term)) {
      for (const syn of synonyms) {
        syn.split(/\s+/).forEach((w) => {
          if (w.length > 2 && !STOPWORDS.has(w)) expandedKeywords.add(w);
        });
      }
    }
  }
  const queryKeywords = [...expandedKeywords];

  // Helper: run transcript search and filter to playable courses
  const searchAndFilter = async (query) => {
    if (!query || query.length < 5) return [];
    const transcriptResults = await searchSegments(query, allCourses);
    return transcriptResults
      .map((result) => {
        const course = allCourses.find((c) => c.code === result.courseCode);
        if (!course || !isPlayable(course)) return null;
        return {
          ...course,
          _relevanceScore: result.score,
          _matchedKeywords: result.matchedKeywords,
        };
      })
      .filter(Boolean);
  };

  // Helper: title/tag/description search
  const titleAndTagSearch = (keywords) => {
    if (keywords.length === 0) return [];
    const playableCourses = allCourses.filter(isPlayable);
    return playableCourses
      .map((course) => {
        const title = (course.title || "").toLowerCase();
        const desc = (course.description || "").toLowerCase();
        const allTags = [
          ...(course.canonical_tags || []),
          ...(course.gemini_system_tags || []),
          ...(course.extracted_tags || []),
          ...(course.ai_tags || []),
        ]
          .map((t) => (typeof t === "string" ? t.toLowerCase() : ""))
          .join(" ");

        let score = 0;
        const matchedKeywords = [];
        for (const kw of keywords) {
          if (title.includes(kw)) { score += 50; matchedKeywords.push(kw); }
          else if (allTags.includes(kw)) { score += 30; matchedKeywords.push(kw); }
          else if (desc.includes(kw)) { score += 10; matchedKeywords.push(kw); }
        }

        // Taxonomy tag boost: courses with matching canonical tags get 3x
        if (taxonomyTagIds.length > 0) {
          const courseTags = (course.canonical_tags || []).map((t) => t.toLowerCase());
          const hasCanonicalMatch = taxonomyTagIds.some((tid) =>
            courseTags.some((ct) => ct.includes(tid.split(".").pop()))
          );
          if (hasCanonicalMatch) score *= 3;
        }
        const uniqueMatched = new Set(matchedKeywords).size;
        if (uniqueMatched >= 2) score *= 1 + uniqueMatched * 0.3;

        // Keyword coverage gate: penalize courses matching too few query keywords
        // Prevents single-keyword partial matches (e.g. "Camera Rigs" for "sequencer camera")
        const coverage = keywords.length > 0 ? uniqueMatched / keywords.length : 1;
        if (keywords.length >= 2 && coverage < 0.5) {
          score *= 0.3; // Heavy penalty for <50% keyword coverage
        } else if (coverage >= 1) {
          score *= 2; // Full-coverage bonus
        }

        if (score === 0) return null;
        return { ...course, _relevanceScore: score, _matchedKeywords: matchedKeywords };
      })
      .filter(Boolean)
      .sort((a, b) => b._relevanceScore - a._relevanceScore);
  };

  // Helper: boost by tag overlap
  const applyTagBoost = (courses) => {
    if (mergedTagIds.length === 0) return courses;
    return courses
      .map((course) => {
        const rawTags = course.extracted_tags || course.tags || [];
        const tagsArray = Array.isArray(rawTags) ? rawTags : Object.values(rawTags);
        const courseTags = tagsArray
          .map((t) => (typeof t === "string" ? t : t.tag_id || t.name || ""))
          .filter(Boolean);
        const hasMatchingTag = courseTags.some((ct) =>
          mergedTagIds.some(
            (st) => ct.toLowerCase().includes(st.toLowerCase()) || st.toLowerCase().includes(ct.toLowerCase())
          )
        );
        return {
          ...course,
          _relevanceScore: hasMatchingTag ? course._relevanceScore * 2 : course._relevanceScore * 0.5,
        };
      })
      .sort((a, b) => b._relevanceScore - a._relevanceScore);
  };

  // Build enriched query
  const enrichedQuery = errorKeywords.length > 0 ? `${userQuery} ${errorKeywords.join(" ")}` : userQuery;

  // Pass 1: Transcript search
  const transcriptResults = await searchAndFilter(enrichedQuery);

  // Pass 2: Title/tag search
  const allQueryKeywords = errorKeywords.length > 0 ? [...queryKeywords, ...errorKeywords] : queryKeywords;
  const titleResults = titleAndTagSearch(allQueryKeywords);

  // Merge both passes
  const seen = new Set();
  const merged = [];
  for (const r of transcriptResults) {
    if (!seen.has(r.code)) { merged.push(r); seen.add(r.code); }
  }
  for (const r of titleResults) {
    if (!seen.has(r.code)) { merged.push(r); seen.add(r.code); }
    else {
      const existing = merged.find((m) => m.code === r.code);
      if (existing) existing._relevanceScore += r._relevanceScore;
    }
  }

  // Pass 2.5: Semantic search (always merged — boost if Tier 1 confident, full weight if not)
  const tier1TopScore = merged.length > 0 ? merged[0]._relevanceScore : 0;
  const tier1Confident = tier1TopScore >= TIER1_CONFIDENCE_THRESHOLD;

  if (semanticResults.length > 0) {
    // When Tier 1 is confident, semantic gets a reduced weight (boost existing matches).
    // When Tier 1 is NOT confident, semantic gets full weight (primary signal).
    const newWeight = tier1Confident ? 60 : 100;
    const boostWeight = tier1Confident ? 20 : 40;
    devLog(`🔀 Semantic merge (Tier 1 score: ${tier1TopScore}, confident: ${tier1Confident}, weight: ${newWeight})`);
    for (const sr of semanticResults) {
      if (!seen.has(sr.code)) {
        const course = allCourses.find((c) => c.code === sr.code);
        if (course && isPlayable(course)) {
          merged.push({
            ...course,
            _relevanceScore: sr.similarity * newWeight,
            _matchedKeywords: ["semantic-match"],
            _semanticMatch: true,
            _tier: tier1Confident ? 2 : 1,
          });
          seen.add(sr.code);
        }
      } else {
        const existing = merged.find((m) => m.code === sr.code);
        if (existing) existing._relevanceScore += sr.similarity * boostWeight;
      }
    }
  }

  merged.sort((a, b) => b._relevanceScore - a._relevanceScore);
  const boosted = applyTagBoost(merged);
  if (boosted.length >= 3) {
    return applyFeedbackBoost(applyVersionFilter(boosted.slice(0, 5), userQuery), boostMap);
  }

  // Pass 3: Broaden with diagnosis terms
  const broadParts = [enrichedQuery, cart?.diagnosis?.problem_summary, ...(cart?.intent?.systems || [])].filter(Boolean);
  const broadQuery = broadParts.join(" ");
  const broadKeywords = broadQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const broadTranscript = await searchAndFilter(broadQuery);
  const broadTitle = titleAndTagSearch(broadKeywords);
  for (const r of [...broadTranscript, ...broadTitle]) {
    if (!seen.has(r.code)) { merged.push(r); seen.add(r.code); }
  }
  merged.sort((a, b) => b._relevanceScore - a._relevanceScore);
  const boostedBroad = applyTagBoost(merged);
  if (boostedBroad.length >= 3) {
    return applyFeedbackBoost(applyVersionFilter(boostedBroad.slice(0, 5), userQuery), boostMap);
  }

  // Fallback: tag graph scoring
  const tagScored = allCourses.map((course) => {
    const result = tagGraphService.scoreCourseRelevance(course, allQueryKeywords);
    return { ...course, _relevanceScore: result.score, _scoreBreakdown: result.breakdown, _topContributors: result.topContributors };
  });
  const fallbackResults = tagScored
    .filter((c) => c._relevanceScore > 0 && isPlayable(c))
    .sort((a, b) => b._relevanceScore - a._relevanceScore)
    .slice(0, 5);
  return applyFeedbackBoost(applyVersionFilter(applyTagBoost(fallbackResults), userQuery), boostMap);
}

/**
 * Apply user feedback boost/penalty from historical watch/skip signals.
 * @param {Array} courses - Scored courses
 * @param {Map<string,number>|null} boostMap - courseCode → multiplier (>1 boost, <1 penalty)
 */
function applyFeedbackBoost(courses, boostMap) {
  if (!boostMap || boostMap.size === 0) return courses;
  return courses
    .map((course) => {
      const multiplier = boostMap.get(course.code);
      if (!multiplier) return course;
      devLog(`📊 Feedback boost: ${course.code} × ${multiplier.toFixed(2)}`);
      return { ...course, _relevanceScore: course._relevanceScore * multiplier };
    })
    .sort((a, b) => b._relevanceScore - a._relevanceScore);
}

/**
 * Version enforcement — adjust scores based on UE version intent.
 */
export function applyVersionFilter(courses, userQuery) {
  const version = detectUEVersion(userQuery);
  if (!version) return courses;
  return courses
    .map((course) => {
      const allTags = [
        ...(course.canonical_tags || []),
        ...(course.gemini_system_tags || []),
        ...(course.extracted_tags || []),
      ].map((t) => (typeof t === "string" ? t.toLowerCase() : ""));
      const hasUE5OnlyTag = allTags.some((t) =>
        [...UE5_ONLY_TAGS].some((ue5) => t.includes(ue5.split(".").pop()))
      );
      if (version === 4 && hasUE5OnlyTag) {
        devLog(`⬇️ UE4 demotion: ${course.code} (has UE5-only tags)`);
        return { ...course, _relevanceScore: course._relevanceScore * 0.2 };
      }
      if (version === 5 && hasUE5OnlyTag) {
        return { ...course, _relevanceScore: course._relevanceScore * 1.5 };
      }
      return course;
    })
    .sort((a, b) => b._relevanceScore - a._relevanceScore);
}
