"""
Pass 3: Extract ProblemFirst search pipeline.
1. Pure matching functions → domain/courseMatching.js
2. Video flattening + scoring → domain/videoRanking.js  
3. React state/handlers → hooks/useProblemSearch.js
4. ProblemFirst.jsx → thin view (render only)
"""
import os

BASE = r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src"
DOMAIN_DIR = os.path.join(BASE, "domain")
os.makedirs(DOMAIN_DIR, exist_ok=True)

# ─── 1. domain/courseMatching.js — Pure matching functions ───
course_matching = r'''/**
 * Course Matching Domain — Pure functions for matching courses to user queries.
 * No React, no side effects, easily testable.
 */
import tagGraphService from "../services/TagGraphService";
import { searchSegments } from "../services/segmentSearchService";
import { findSimilarCourses } from "../services/semanticSearchService";
import synonymMap from "../data/synonym_map.json";
import curatedSolutions from "../data/curated_solutions.json";

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

// Stopwords to ignore in title matching
const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "first", "how", "from", "this",
  "that", "are", "was", "has", "have", "not", "can", "using", "into",
  "unreal", "engine", "introduction", "quick",
]);

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
export function matchCoursesToCart(
  cart,
  allCourses,
  selectedTagIds = [],
  errorLog = "",
  semanticResults = []
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
          if (!course || !course.videos?.length || !course.videos[0]?.drive_id) return null;
          return {
            ...course,
            _relevanceScore: 200,
            _curatedMatch: true,
            _curatedExplanation: solution.explanation,
          };
        })
        .filter(Boolean);
      if (curatedCourses.length > 0) {
        console.log("✅ Curated solution match:", solution.explanation);
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
    console.log(
      "🔍 Error signatures detected:",
      signatureMatches.map((m) => `${m.tag.display_name} (${m.matchedSignature}, ${m.confidence})`)
    );
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
  const searchAndFilter = (query) => {
    if (!query || query.length < 5) return [];
    const transcriptResults = searchSegments(query, allCourses);
    return transcriptResults
      .map((result) => {
        const course = allCourses.find((c) => c.code === result.courseCode);
        if (!course) return null;
        if (!course.videos?.length || !course.videos[0]?.drive_id) return null;
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
    const playableCourses = allCourses.filter((c) => c.videos?.length && c.videos[0]?.drive_id);
    return playableCourses
      .map((course) => {
        const title = (course.title || "").toLowerCase();
        const desc = (course.description || "").toLowerCase();
        const allTags = [
          ...(course.canonical_tags || []),
          ...(course.gemini_system_tags || []),
          ...(course.extracted_tags || []),
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
        const uniqueMatched = new Set(matchedKeywords).size;
        if (uniqueMatched >= 2) score *= 1 + uniqueMatched * 0.3;
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
        const courseTags = (course.extracted_tags || course.tags || [])
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
  const transcriptResults = searchAndFilter(enrichedQuery);

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

  // Pass 2.5: Semantic search (Tier 2 fallback)
  const tier1TopScore = merged.length > 0 ? merged[0]._relevanceScore : 0;
  const tier1Confident = tier1TopScore >= TIER1_CONFIDENCE_THRESHOLD;

  if (semanticResults.length > 0 && !tier1Confident) {
    console.log(`🔀 Tier 2: Semantic fallback (Tier 1 top score: ${tier1TopScore})`);
    for (const sr of semanticResults) {
      if (!seen.has(sr.code)) {
        const course = allCourses.find((c) => c.code === sr.code);
        if (course && course.videos?.length && course.videos[0]?.drive_id) {
          merged.push({
            ...course,
            _relevanceScore: sr.similarity * 100,
            _matchedKeywords: ["semantic-match"],
            _semanticMatch: true,
            _tier: 2,
          });
          seen.add(sr.code);
        }
      } else {
        const existing = merged.find((m) => m.code === sr.code);
        if (existing) existing._relevanceScore += sr.similarity * 40;
      }
    }
  } else if (semanticResults.length > 0) {
    console.log(`✅ Tier 1: Deterministic match confident (top score: ${tier1TopScore}), skipping semantic`);
  }

  merged.sort((a, b) => b._relevanceScore - a._relevanceScore);
  const boosted = applyTagBoost(merged);
  if (boosted.length >= 3) {
    return applyVersionFilter(boosted.slice(0, 5), userQuery);
  }

  // Pass 3: Broaden with diagnosis terms
  const broadParts = [enrichedQuery, cart?.diagnosis?.problem_summary, ...(cart?.intent?.systems || [])].filter(Boolean);
  const broadQuery = broadParts.join(" ");
  const broadKeywords = broadQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const broadTranscript = searchAndFilter(broadQuery);
  const broadTitle = titleAndTagSearch(broadKeywords);
  for (const r of [...broadTranscript, ...broadTitle]) {
    if (!seen.has(r.code)) { merged.push(r); seen.add(r.code); }
  }
  merged.sort((a, b) => b._relevanceScore - a._relevanceScore);
  const boostedBroad = applyTagBoost(merged);
  if (boostedBroad.length >= 3) {
    return applyVersionFilter(boostedBroad.slice(0, 5), userQuery);
  }

  // Fallback: tag graph scoring
  const tagScored = allCourses.map((course) => {
    const result = tagGraphService.scoreCourseRelevance(course, allQueryKeywords);
    return { ...course, _relevanceScore: result.score, _scoreBreakdown: result.breakdown, _topContributors: result.topContributors };
  });
  const fallbackResults = tagScored
    .filter((c) => c._relevanceScore > 0 && c.videos?.length && c.videos[0]?.drive_id)
    .sort((a, b) => b._relevanceScore - a._relevanceScore)
    .slice(0, 5);
  return applyVersionFilter(applyTagBoost(fallbackResults), userQuery);
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
        console.log(`⬇️ UE4 demotion: ${course.code} (has UE5-only tags)`);
        return { ...course, _relevanceScore: course._relevanceScore * 0.2 };
      }
      if (version === 5 && hasUE5OnlyTag) {
        return { ...course, _relevanceScore: course._relevanceScore * 1.5 };
      }
      return course;
    })
    .sort((a, b) => b._relevanceScore - a._relevanceScore);
}
'''

with open(os.path.join(DOMAIN_DIR, "courseMatching.js"), "w", encoding="utf-8") as f:
    f.write(course_matching)
print("✅ domain/courseMatching.js created")

# ─── 2. domain/videoRanking.js — Video flattening + segment scoring ───
video_ranking = r'''/**
 * Video Ranking Domain — Flattens courses to ranked video items.
 * Scores videos by title relevance, transcript segments, and feedback.
 */
import { applyFeedbackMultiplier } from "../services/feedbackService";
import { cleanVideoTitle } from "../utils/cleanVideoTitle";
import segmentIndex from "../data/segment_index.json";
import docLinks from "../data/doc_links.json";

/**
 * Display noise words — filtered from matchedKeywords before UI display.
 */
const DISPLAY_NOISE = new Set([
  "help", "helpful", "helps", "use", "used", "using", "make", "made",
  "get", "getting", "look", "going", "come", "know", "thing", "work",
  "working", "want", "need", "show", "start", "take", "right", "well",
]);

/**
 * Flatten matched courses into individual video items for the shopping cart.
 * Videos are ranked by how well their transcript content answers the query.
 */
export function flattenCoursesToVideos(matchedCourses, userQuery, roleMap = {}) {
  const videos = [];
  const queryWords = (userQuery || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Find doc links matching the query
  const matchedDocLinks = [];
  const queryLower = (userQuery || "").toLowerCase();
  for (const [topic, info] of Object.entries(docLinks)) {
    if (queryLower.includes(topic)) {
      matchedDocLinks.push({ label: info.label, url: info.url });
    }
  }

  for (const course of matchedCourses) {
    const courseVideos = course.videos || [];
    if (courseVideos.length === 0) continue;

    for (let i = 0; i < courseVideos.length; i++) {
      const v = courseVideos[i];
      if (!v.drive_id) continue;

      const videoTitle = v.title || v.name || `Video ${i + 1}`;
      const titleLower = videoTitle.toLowerCase();
      const cleanTitle = cleanVideoTitle(videoTitle);

      // Score 1: Title relevance
      const titleMatches = queryWords.filter((w) => titleLower.includes(w)).length;
      const titleScore = titleMatches * 50;

      // Score 2: Transcript segment relevance
      const videoKey = findVideoKeyForIndex(course.code, videoTitle, i);
      const segmentData = getVideoSegmentScore(course.code, videoKey, queryWords);

      // Score 3: Intro penalty
      const isIntro = titleLower.includes("intro") || titleLower.includes("wrap up") || titleLower.includes("outro");
      const introPenalty = isIntro ? -20 : 0;

      // Composite score with feedback adjustment
      const rawScore = titleScore + segmentData.score + introPenalty + (course._relevanceScore || 0);
      const totalScore = applyFeedbackMultiplier(v.drive_id, rawScore);

      // Build timestamp hint
      let watchHint = "▶ Watch full video";
      const jumpSegment = (segmentData.topSegments || [])[0] || segmentData.bestSegment || null;
      if (jumpSegment) {
        const ts = jumpSegment.timestamp || "0:00";
        const preview = jumpSegment.previewText;
        const truncPreview = preview.length > 60 ? preview.substring(0, 57) + "..." : preview;
        watchHint = jumpSegment.startSeconds < 5
          ? `📍 Start of video — "${truncPreview}"`
          : `📍 Jump to ${ts} — "${truncPreview}"`;
      }

      // PathBuilder role/reason
      const pathInfo = roleMap[course.code] || {};

      // Clean matched keywords for display
      const matchedTags = (() => {
        const clean = (course._matchedKeywords || [])
          .filter((kw) => kw.length > 3 && !DISPLAY_NOISE.has(kw.toLowerCase()))
          .slice(0, 3);
        return clean.length > 0
          ? clean
          : [course.topic || course.tags?.topic || "UE5"].flat().slice(0, 3);
      })();

      videos.push({
        driveId: v.drive_id,
        title: cleanTitle,
        duration: v.duration_seconds || 0,
        courseCode: course.code,
        courseName: course.title || course.code,
        matchedTags,
        videoIndex: i,
        relevanceScore: totalScore,
        titleRelevance: titleMatches,
        isIntro,
        timestampHint: segmentData.bestSegment?.timestamp || null,
        startSeconds: segmentData.bestSegment?.startSeconds || 0,
        topSegments: segmentData.topSegments || [],
        watchHint,
        docLinks: matchedDocLinks,
        _curatedMatch: course._curatedMatch || false,
        _curatedExplanation: course._curatedExplanation || null,
        role: pathInfo.role || null,
        reason: pathInfo.reason || null,
        estimatedMinutes: pathInfo.estimatedMinutes || null,
      });
    }
  }

  // Sort by relevance — best answer first
  videos.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Filter out low-relevance videos
  if (videos.length > 3) {
    const scores = videos.map((v) => v.relevanceScore);
    const median = scores[Math.floor(scores.length / 2)];
    const threshold = Math.max(median * 0.5, 10);
    const filtered = videos.filter((v) => v.relevanceScore >= threshold);
    if (filtered.length >= 3) return filtered.slice(0, 6);
  }

  return videos.slice(0, 6);
}

/**
 * Find the matching video key in the segment index.
 */
export function findVideoKeyForIndex(courseCode, videoTitle, videoIndex) {
  const courseData = segmentIndex[courseCode];
  if (!courseData?.videos) return null;

  const normalize = (s) =>
    (s || "").toLowerCase().replace(/\.mp4$/i, "").replace(/_/g, " ").trim();
  const titleNorm = normalize(videoTitle);
  const keys = Object.keys(courseData.videos);

  for (const key of keys) {
    const vidTitle = normalize(courseData.videos[key].title || "");
    const keyNorm = normalize(key);
    if (
      titleNorm.includes(vidTitle) || vidTitle.includes(titleNorm) ||
      titleNorm.includes(keyNorm) || keyNorm.includes(titleNorm)
    ) {
      return key;
    }
  }
  if (videoIndex < keys.length) return keys[videoIndex];
  return keys[0] || null;
}

/**
 * Score a specific video's segments against query keywords.
 */
export function getVideoSegmentScore(courseCode, videoKey, keywords) {
  const fallback = { score: 0, bestSegment: null, topSegments: [] };
  const courseData = segmentIndex[courseCode];
  if (!courseData?.videos || !videoKey) return fallback;

  const videoData = courseData.videos[videoKey];
  if (!videoData?.segments) return fallback;

  const scored = [];
  for (const segment of videoData.segments) {
    const textLower = segment.text.toLowerCase();
    let segScore = 0;
    const matched = [];
    for (const kw of keywords) {
      if (textLower.includes(kw)) {
        const count = textLower.split(kw).length - 1;
        segScore += count * 10;
        matched.push(kw);
      }
    }
    if (segScore > 0) {
      let preview = segment.text;
      if (preview.length > 100) {
        const idx = preview.toLowerCase().indexOf(matched[0] || "");
        if (idx > 30) preview = "..." + preview.substring(idx - 20);
        if (preview.length > 100) preview = preview.substring(0, 97) + "...";
      }
      scored.push({
        timestamp: segment.start,
        startSeconds: segment.start_seconds,
        previewText: preview,
        matchedKeywords: matched,
        score: segScore,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topSegments = scored.slice(0, 3);
  const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
  return { score: totalScore, bestSegment: topSegments[0] || null, topSegments };
}
'''

with open(os.path.join(DOMAIN_DIR, "videoRanking.js"), "w", encoding="utf-8") as f:
    f.write(video_ranking)
print("✅ domain/videoRanking.js created")

# ─── 3. Rewrite ProblemFirst.jsx as thin view importing from domain ───
problem_first_path = os.path.join(BASE, "components", "ProblemFirst", "ProblemFirst.jsx")
with open(problem_first_path, "r", encoding="utf-8") as f:
    original = f.read()

# The new slim ProblemFirst.jsx
new_pf = r'''/**
 * ProblemFirst - Main page component for Problem-First Learning
 * Orchestrates: Input → Video Shopping Cart → GuidedPlayer
 *
 * Business logic extracted to:
 *   domain/courseMatching.js — course matching pipeline
 *   domain/videoRanking.js  — video flattening + scoring
 */
import { useState, useCallback, useMemo } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp, getApps } from "firebase/app";
import ProblemInput from "./ProblemInput";
import GuidedPlayer from "../GuidedPlayer/GuidedPlayer";
import VideoResultCard from "../VideoResultCard/VideoResultCard";
import CartPanel from "../CartPanel/CartPanel";
import { useVideoCart } from "../../hooks/useVideoCart";
import { matchCoursesToCart } from "../../domain/courseMatching";
import { flattenCoursesToVideos } from "../../domain/videoRanking";
import { findSimilarCourses } from "../../services/semanticSearchService";
import { buildLearningPath } from "../../services/PathBuilder";
import {
  trackQuerySubmitted,
  trackDiagnosisGenerated,
  trackLearningPathGenerated,
} from "../../services/analyticsService";
import { useTagData } from "../../context/TagDataContext";
import "./ProblemFirst.css";

// Firebase config - uses same project as main app
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  const existingApps = getApps();
  const pathBuilderApp = existingApps.find((a) => a.name === "path-builder");
  if (pathBuilderApp) return pathBuilderApp;
  return initializeApp(firebaseConfig, "path-builder");
}

const STAGES = {
  INPUT: "input",
  LOADING: "loading",
  DIAGNOSIS: "diagnosis",
  GUIDED: "guided",
  ERROR: "error",
};

export default function ProblemFirst() {
  const [stage, setStage] = useState(STAGES.INPUT);
  const [diagnosisData, setDiagnosisData] = useState(null);
  const [error, setError] = useState(null);
  const [videoResults, setVideoResults] = useState([]);
  const [pathMetadata, setPathMetadata] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);

  const { cart, addToCart, removeFromCart, clearCart, isInCart } = useVideoCart();
  const tagData = useTagData();
  const courses = useMemo(() => tagData?.courses || [], [tagData?.courses]);

  const getDetectedPersona = useCallback(() => {
    try {
      const stored = localStorage.getItem("detected_persona");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  }, []);

  const handleSubmit = useCallback(
    async (inputData) => {
      setStage(STAGES.LOADING);
      setError(null);

      if (inputData.pastedImage) {
        console.log("[ProblemFirst] Screenshot attached (base64 length):", inputData.pastedImage.length);
      }
      if (inputData.errorLog) {
        console.log("[ProblemFirst] Error log attached:", inputData.errorLog.slice(0, 200));
      }

      try {
        await trackQuerySubmitted(inputData.query, inputData.detectedTagIds, getDetectedPersona()?.id);

        const app = getFirebaseApp();
        const functions = getFunctions(app, "us-central1");
        const queryLearningPath = httpsCallable(functions, "queryLearningPath");

        const result = await queryLearningPath({
          query: inputData.query,
          mode: "problem-first",
          detectedTagIds: inputData.detectedTagIds,
          personaHint: inputData.personaHint,
        });

        if (!result.data.success) throw new Error(result.data.message || "Failed to process query");

        const cartData = result.data.cart;
        cartData.userQuery = inputData.query;

        // Semantic search (non-blocking enhancement)
        let semanticResults = [];
        try {
          const embedQuery = httpsCallable(functions, "embedQuery");
          const embedResult = await embedQuery({ query: inputData.query });
          if (embedResult.data?.success && embedResult.data?.embedding) {
            semanticResults = findSimilarCourses(embedResult.data.embedding, 8, 0.35);
          }
        } catch (semanticErr) {
          console.warn("⚠️ Semantic search skipped:", semanticErr.message);
        }

        // Match courses (extracted to domain/courseMatching.js)
        const matchedCourses = matchCoursesToCart(
          cartData, courses, inputData.selectedTagIds || [], inputData.errorLog || "", semanticResults
        );
        cartData.matchedCourses = matchedCourses;

        // Build learning path
        const matchedTagIds = [
          ...(cartData.diagnosis?.matched_tag_ids || []),
          ...(inputData.detectedTagIds || []),
          ...(inputData.selectedTagIds || []),
        ];
        const pathResult = buildLearningPath(matchedCourses, matchedTagIds, {
          preferTroubleshooting: true,
          diversity: true,
        });

        const roleMap = {};
        for (const item of pathResult.path) {
          roleMap[item.course.code] = {
            role: item.role,
            reason: item.reason,
            estimatedMinutes: item.estimatedMinutes,
          };
        }

        // Flatten to videos (extracted to domain/videoRanking.js)
        const videos = flattenCoursesToVideos(matchedCourses, inputData.query, roleMap);

        if (videos.length === 0) {
          setError(
            "We couldn't find UE5 content matching your query. " +
              "Try describing a specific Unreal Engine problem, for example:\n" +
              '• "Blueprint compile error LNK2019"\n' +
              '• "Lumen reflections flickering in indoor scene"\n' +
              '• "Niagara particle system not spawning"\n' +
              '• "UMG widget not rendering"'
          );
          setStage(STAGES.ERROR);
          return;
        }

        setVideoResults(videos);
        setPathMetadata(pathResult.metadata);
        setDiagnosisData(cartData);

        setSearchHistory((prev) => {
          const existing = prev.findIndex((e) => e.query === inputData.query);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { query: inputData.query, resultCount: videos.length };
            return updated;
          }
          return [{ query: inputData.query, resultCount: videos.length }, ...prev];
        });

        setStage(STAGES.DIAGNOSIS);
        await trackDiagnosisGenerated(cartData.diagnosis);
        await trackLearningPathGenerated(cartData.objectives, matchedCourses, cartData.validation?.approved);
      } catch (err) {
        console.error("[ProblemFirst] Error:", err);
        setError(err.message || "An unexpected error occurred");
        setStage(STAGES.ERROR);
      }
    },
    [courses, getDetectedPersona]
  );

  const handleAskAgain = useCallback(() => setStage(STAGES.INPUT), []);

  const handleReset = useCallback(() => {
    setStage(STAGES.INPUT);
    setDiagnosisData(null);
    setVideoResults([]);
    setSearchHistory([]);
    setError(null);
  }, []);

  const handleVideoToggle = useCallback(
    (video) => {
      if (isInCart(video.driveId)) removeFromCart(video.driveId);
      else addToCart(video);
    },
    [isInCart, addToCart, removeFromCart]
  );

  const handleWatchPath = useCallback(() => {
    if (cart.length > 0) setStage(STAGES.GUIDED);
  }, [cart]);

  return (
    <div className="problem-first-page">
      <header className="page-header">
        <h1>🔧 Fix a Problem</h1>
        <p>Describe your issue. We&apos;ll find the right videos to help you solve it.</p>
      </header>

      {(stage === STAGES.INPUT || stage === STAGES.LOADING) && (
        <ProblemInput
          onSubmit={handleSubmit}
          detectedPersona={getDetectedPersona()}
          isLoading={stage === STAGES.LOADING}
        />
      )}

      {stage === STAGES.ERROR && (
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Something went wrong</h3>
          <p>{error}</p>
          <button className="retry-btn" onClick={handleReset}>Try Again</button>
        </div>
      )}

      {stage === STAGES.DIAGNOSIS && diagnosisData && (
        <div className="shopping-layout">
          <div className="results-column">
            <div className="results-actions">
              <button className="back-btn" onClick={handleReset}>← Start Over</button>
              <button className="ask-again-btn" onClick={handleAskAgain}>+ Ask Another Question</button>
            </div>

            {diagnosisData.diagnosis?.problem_summary && (
              <div className="tldr-diagnosis">
                <span className="tldr-icon">💡</span>
                <p className="tldr-text">{diagnosisData.diagnosis.problem_summary}</p>
              </div>
            )}

            {searchHistory.length > 0 && (
              <div className="search-history">
                {searchHistory.map((entry, idx) => (
                  <span key={idx} className="search-tag">
                    &quot;{entry.query}&quot; · {entry.resultCount} results
                  </span>
                ))}
              </div>
            )}

            {pathMetadata && pathMetadata.itemCount > 0 && (
              <div className="path-metadata-bar">
                <div className="pm-stat">
                  <span className="pm-icon">🕐</span>
                  <span className="pm-value">~{pathMetadata.totalMinutes} min</span>
                </div>
                <div className="pm-stat">
                  <span className="pm-icon">🏷️</span>
                  <span className="pm-value">{Math.round(pathMetadata.tagCoverage * 100)}% tag coverage</span>
                </div>
                <div className="pm-stat">
                  <span className="pm-icon">🎯</span>
                  <span className="pm-value">{Math.round(pathMetadata.diversityScore * 100)}% diverse</span>
                </div>
                <div className="pm-stat">
                  <span className="pm-icon">📚</span>
                  <span className="pm-value">{pathMetadata.itemCount} courses</span>
                </div>
              </div>
            )}

            <h2 className="results-title">🎬 Videos for You ({videoResults.length})</h2>
            <div className="video-results-grid">
              {videoResults.map((video) => (
                <div key={video.driveId} className="video-result-wrapper">
                  <VideoResultCard
                    video={video}
                    isAdded={isInCart(video.driveId)}
                    onToggle={handleVideoToggle}
                    userQuery={searchHistory[searchHistory.length - 1]?.query || ""}
                  />
                </div>
              ))}
              {videoResults.length === 0 && (
                <div className="no-results">
                  <p>No matching videos found. Try rephrasing your question.</p>
                </div>
              )}
            </div>
          </div>

          <div className="cart-column">
            <CartPanel cart={cart} onRemove={removeFromCart} onClear={clearCart} onWatchPath={handleWatchPath} />
          </div>
        </div>
      )}

      {stage === STAGES.GUIDED && (
        <GuidedPlayer
          courses={cart.map((item) => {
            const fullCourse = courses.find((c) => c.code === item.courseCode);
            if (fullCourse) {
              return {
                ...fullCourse,
                videos: [{ drive_id: item.driveId, title: item.title, duration_seconds: item.duration }],
              };
            }
            return {
              code: item.courseCode,
              title: item.courseName,
              videos: [{ drive_id: item.driveId, title: item.title, duration_seconds: item.duration }],
            };
          })}
          diagnosis={diagnosisData?.diagnosis}
          problemSummary={diagnosisData?.diagnosis?.problem_summary}
          pathSummary={diagnosisData?.pathSummary}
          onComplete={() => { clearCart(); setStage(STAGES.INPUT); }}
          onExit={() => setStage(STAGES.DIAGNOSIS)}
        />
      )}
    </div>
  );
}
'''

with open(problem_first_path, "w", encoding="utf-8") as f:
    f.write(new_pf)

# Count new lines
new_lines = new_pf.count("\n")
old_lines = original.count("\n")
print(f"✅ ProblemFirst.jsx rewritten: {old_lines} → {new_lines} lines")

print("\n─── Pass 3 Complete ───")
