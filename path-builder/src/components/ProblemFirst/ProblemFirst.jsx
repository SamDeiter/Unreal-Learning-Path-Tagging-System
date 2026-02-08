/**
 * ProblemFirst - Main page component for Problem-First Learning
 * Orchestrates: Input → Video Shopping Cart → GuidedPlayer
 */
import { useState, useCallback, useMemo } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp, getApps } from "firebase/app";
import ProblemInput from "./ProblemInput";
import GuidedPlayer from "../GuidedPlayer/GuidedPlayer";
import VideoResultCard from "../VideoResultCard/VideoResultCard";
import CartPanel from "../CartPanel/CartPanel";
import { useVideoCart } from "../../hooks/useVideoCart";
import tagGraphService from "../../services/TagGraphService";
import { searchSegments } from "../../services/segmentSearchService";
import { findSimilarCourses } from "../../services/semanticSearchService";
import { applyFeedbackMultiplier } from "../../services/feedbackService";
import { cleanVideoTitle } from "../../utils/cleanVideoTitle";
import {
  trackQuerySubmitted,
  trackDiagnosisGenerated,
  trackLearningPathGenerated,
} from "../../services/analyticsService";
import { useTagData } from "../../context/TagDataContext";
import synonymMap from "../../data/synonym_map.json";
import curatedSolutions from "../../data/curated_solutions.json";
import segmentIndex from "../../data/segment_index.json";
import docLinks from "../../data/doc_links.json";
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

// Helper to get or create Firebase app instance
function getFirebaseApp() {
  const existingApps = getApps();
  const pathBuilderApp = existingApps.find((a) => a.name === "path-builder");
  if (pathBuilderApp) return pathBuilderApp;
  return initializeApp(firebaseConfig, "path-builder");
}

// Flow stages
const STAGES = {
  INPUT: "input",
  LOADING: "loading",
  DIAGNOSIS: "diagnosis",
  GUIDED: "guided", // New: AI-narrated player
  ERROR: "error",
};

const CART_STORAGE_KEY = "problem-first-cart";

// Phase 8A: Tiered matching threshold — semantic search only fires when
// deterministic passes score below this value
const TIER1_CONFIDENCE_THRESHOLD = 60;

// Phase 8A: UE5-only tag prefixes (engine_versions.min >= "5.0" in tags.json)
const UE5_ONLY_TAGS = new Set([
  "rendering.lumen",
  "rendering.nanite",
  "rendering.virtualShadowMaps",
  "rendering.substrate",
  "worldbuilding.worldPartition",
]);

/**
 * Detect UE version intent from user query.
 * @returns {number|null} 4, 5, or null (no version specified)
 */
function detectUEVersion(query) {
  const q = (query || "").toLowerCase();
  if (/\bue\s*5\b|\bunreal\s*engine\s*5\b|\b5\.\d\b/.test(q)) return 5;
  if (/\bue\s*4\b|\bunreal\s*engine\s*4\b|\b4\.\d{1,2}\b/.test(q)) return 4;
  return null;
}

// cleanVideoTitle imported from ../../utils/cleanVideoTitle

/**
 * Flatten matched courses into individual video items for the shopping cart.
 * Videos are ranked by how well their transcript content answers the query,
 * using real segment data from the pre-built segment index.
 */
function flattenCoursesToVideos(matchedCourses, userQuery) {
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

      // --- Score 1: Title relevance ---
      const titleMatches = queryWords.filter((w) => titleLower.includes(w)).length;
      const titleScore = titleMatches * 50;

      // --- Score 2: Transcript segment relevance (real timestamps) ---
      // Build a video filename pattern to match against segment index
      const videoKey = findVideoKeyForIndex(course.code, videoTitle, i);
      const segmentData = getVideoSegmentScore(course.code, videoKey, queryWords);

      // --- Score 3: Intro penalty (intros are less specific) ---
      const isIntro =
        titleLower.includes("intro") ||
        titleLower.includes("wrap up") ||
        titleLower.includes("outro");
      const introPenalty = isIntro ? -20 : 0;

      // Composite score with feedback adjustment
      const rawScore =
        titleScore + segmentData.score + introPenalty + (course._relevanceScore || 0);
      const totalScore = applyFeedbackMultiplier(v.drive_id, rawScore);

      // Build timestamp hint from best segment match (skip 0:00 — that's just the start)
      let watchHint = "▶ Watch full video";
      const jumpSegment =
        (segmentData.topSegments || []).find((s) => s.startSeconds > 5) ||
        (segmentData.bestSegment?.startSeconds > 5 ? segmentData.bestSegment : null);
      if (jumpSegment) {
        const ts = jumpSegment.timestamp;
        const preview = jumpSegment.previewText;
        const truncPreview = preview.length > 60 ? preview.substring(0, 57) + "..." : preview;
        watchHint = `📍 Jump to ${ts} — "${truncPreview}"`;
      }

      videos.push({
        driveId: v.drive_id,
        title: cleanTitle,
        duration: v.duration_seconds || 0,
        courseCode: course.code,
        courseName: course.title || course.code,
        matchedTags: (course._matchedKeywords || []).slice(0, 3),
        videoIndex: i,
        relevanceScore: totalScore,
        titleRelevance: titleMatches,
        isIntro,
        timestampHint: segmentData.bestSegment?.timestamp || null,
        startSeconds: segmentData.bestSegment?.startSeconds || 0,
        topSegments: (segmentData.topSegments || []).filter((s) => s.startSeconds > 5),
        watchHint,
        docLinks: matchedDocLinks,
        _curatedMatch: course._curatedMatch || false,
        _curatedExplanation: course._curatedExplanation || null,
      });
    }
  }

  // Sort by relevance score — best answer to the question first
  videos.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Systemic fix: filter out videos that don't meet a relevance threshold.
  // This prevents mixed-content courses from surfacing irrelevant videos
  // (e.g., "CPU Lightmass" showing up for a "Lumen reflections" query).
  if (videos.length > 3) {
    const scores = videos.map((v) => v.relevanceScore);
    const median = scores[Math.floor(scores.length / 2)];
    const threshold = Math.max(median * 0.5, 10); // At least 10 points or 50% of median

    const filtered = videos.filter((v) => v.relevanceScore >= threshold);
    // Keep at least 3 results even if filtering is aggressive
    if (filtered.length >= 3) {
      return filtered.slice(0, 6);
    }
  }

  return videos.slice(0, 6); // Tighter cap: 6 max (was 10)
}

/**
 * Find the matching video key in the segment index for a given video.
 */
function findVideoKeyForIndex(courseCode, videoTitle, videoIndex) {
  const courseData = segmentIndex[courseCode];
  if (!courseData?.videos) return null;

  // Normalize: lowercase, strip .mp4, replace underscores with spaces
  const normalize = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/\.mp4$/i, "")
      .replace(/_/g, " ")
      .trim();
  const titleNorm = normalize(videoTitle);
  const keys = Object.keys(courseData.videos);

  // Try to match by video title (normalized)
  for (const key of keys) {
    const vidTitle = normalize(courseData.videos[key].title || "");
    const keyNorm = normalize(key);
    if (
      titleNorm.includes(vidTitle) ||
      vidTitle.includes(titleNorm) ||
      titleNorm.includes(keyNorm) ||
      keyNorm.includes(titleNorm)
    ) {
      return key;
    }
  }

  // Fallback: match by index position
  if (videoIndex < keys.length) {
    return keys[videoIndex];
  }
  return keys[0] || null;
}

/**
 * Score a specific video's segments against query keywords.
 * Returns the total score, best matching segment, and top 3 segments.
 */
function getVideoSegmentScore(courseCode, videoKey, keywords) {
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
        // Count occurrences
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

  return {
    score: totalScore,
    bestSegment: topSegments[0] || null,
    topSegments,
  };
}

export default function ProblemFirst() {
  const [stage, setStage] = useState(STAGES.INPUT);
  const [diagnosisData, setDiagnosisData] = useState(null);
  const [error, setError] = useState(null);
  const [videoResults, setVideoResults] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);

  // Video shopping cart (persisted in localStorage)
  const { cart, addToCart, removeFromCart, clearCart, isInCart } = useVideoCart();

  // Get courses from context using the hook
  const tagData = useTagData();
  const courses = useMemo(() => tagData?.courses || [], [tagData?.courses]);

  // Get detected persona from localStorage if available
  const getDetectedPersona = useCallback(() => {
    try {
      const stored = localStorage.getItem("detected_persona");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const handleSubmit = useCallback(
    async (inputData) => {
      setStage(STAGES.LOADING);
      setError(null);

      // Log attachments for later backend integration
      if (inputData.pastedImage) {
        console.log(
          "[ProblemFirst] Screenshot attached (base64 length):",
          inputData.pastedImage.length
        );
      }
      if (inputData.errorLog) {
        console.log("[ProblemFirst] Error log attached:", inputData.errorLog.slice(0, 200));
      }

      try {
        // Track analytics
        await trackQuerySubmitted(
          inputData.query,
          inputData.detectedTagIds,
          getDetectedPersona()?.id
        );

        // Call the unified query endpoint
        const app = getFirebaseApp();
        const functions = getFunctions(app, "us-central1");
        const queryLearningPath = httpsCallable(functions, "queryLearningPath");

        const result = await queryLearningPath({
          query: inputData.query,
          mode: "problem-first",
          detectedTagIds: inputData.detectedTagIds,
          personaHint: inputData.personaHint,
        });

        if (!result.data.success) {
          throw new Error(result.data.message || "Failed to process query");
        }

        const cartData = result.data.cart;
        cartData.userQuery = inputData.query;

        // Semantic search: get query embedding (non-blocking, enhances results)
        let semanticResults = [];
        try {
          const embedQuery = httpsCallable(functions, "embedQuery");
          const embedResult = await embedQuery({ query: inputData.query });
          if (embedResult.data?.success && embedResult.data?.embedding) {
            semanticResults = findSimilarCourses(embedResult.data.embedding, 8, 0.35);
            console.log(
              "🧠 Semantic matches:",
              semanticResults.map((r) => `${r.code} (${r.similarity.toFixed(2)}`)
            );
          }
        } catch (semanticErr) {
          console.warn("⚠️ Semantic search skipped:", semanticErr.message);
        }

        // Match courses using transcript search + semantic + tags for accuracy
        const matchedCourses = matchCoursesToCart(
          cartData,
          courses,
          inputData.selectedTagIds || [],
          inputData.errorLog || "",
          semanticResults
        );
        cartData.matchedCourses = matchedCourses;

        // Flatten to individual videos
        const videos = flattenCoursesToVideos(matchedCourses, inputData.query);
        setVideoResults(videos);
        setDiagnosisData(cartData);

        // Track search history for multi-query support (dedup by query text)
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

        // Track success
        await trackDiagnosisGenerated(cartData.diagnosis);
        await trackLearningPathGenerated(
          cartData.objectives,
          matchedCourses,
          cartData.validation?.approved
        );
      } catch (err) {
        console.error("[ProblemFirst] Error:", err);
        setError(err.message || "An unexpected error occurred");
        setStage(STAGES.ERROR);
      }
    },
    [courses, getDetectedPersona]
  );

  // "Ask Again" — go back to input without clearing cart
  const handleAskAgain = useCallback(() => {
    setStage(STAGES.INPUT);
  }, []);

  // Full reset — clears everything
  const handleReset = useCallback(() => {
    setStage(STAGES.INPUT);
    setDiagnosisData(null);
    setVideoResults([]);
    setSearchHistory([]);
    setError(null);
  }, []);

  // Toggle video in/out of cart
  const handleVideoToggle = useCallback(
    (video) => {
      if (isInCart(video.driveId)) {
        removeFromCart(video.driveId);
      } else {
        addToCart(video);
      }
    },
    [isInCart, addToCart, removeFromCart]
  );

  // Watch Path — pass cart items to GuidedPlayer
  const handleWatchPath = useCallback(() => {
    if (cart.length > 0) {
      setStage(STAGES.GUIDED);
    }
  }, [cart]);

  return (
    <div className="problem-first-page">
      {/* Header */}
      <header className="page-header">
        <h1>🔧 Fix a Problem</h1>
        <p>Describe your issue. We'll find the right videos to help you solve it.</p>
      </header>

      {/* Stage: Input */}
      {(stage === STAGES.INPUT || stage === STAGES.LOADING) && (
        <ProblemInput
          onSubmit={handleSubmit}
          detectedPersona={getDetectedPersona()}
          isLoading={stage === STAGES.LOADING}
        />
      )}

      {/* Stage: Error */}
      {stage === STAGES.ERROR && (
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Something went wrong</h3>
          <p>{error}</p>
          <button className="retry-btn" onClick={handleReset}>
            Try Again
          </button>
        </div>
      )}

      {/* Stage: Diagnosis — Shopping Cart Layout */}
      {stage === STAGES.DIAGNOSIS && diagnosisData && (
        <div className="shopping-layout">
          {/* Left: Results */}
          <div className="results-column">
            {/* Action bar */}
            <div className="results-actions">
              <button className="back-btn" onClick={handleReset}>
                ← Start Over
              </button>
              <button className="ask-again-btn" onClick={handleAskAgain}>
                + Ask Another Question
              </button>
            </div>

            {/* TL;DR Diagnosis */}
            {diagnosisData.diagnosis?.problem_summary && (
              <div className="tldr-diagnosis">
                <span className="tldr-icon">💡</span>
                <p className="tldr-text">{diagnosisData.diagnosis.problem_summary}</p>
              </div>
            )}

            {/* Search history */}
            {searchHistory.length > 0 && (
              <div className="search-history">
                {searchHistory.map((entry, idx) => (
                  <span key={idx} className="search-tag">
                    "{entry.query}" · {entry.resultCount} results
                  </span>
                ))}
              </div>
            )}

            {/* Video Results Grid */}
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

          {/* Right: Sticky Cart */}
          <div className="cart-column">
            <CartPanel
              cart={cart}
              onRemove={removeFromCart}
              onClear={clearCart}
              onWatchPath={handleWatchPath}
            />
          </div>
        </div>
      )}

      {/* Stage: Guided Player */}
      {stage === STAGES.GUIDED && (
        <GuidedPlayer
          courses={cart.map((item) => {
            // Look up full course data for metadata (tags, description, etc.)
            const fullCourse = courses.find((c) => c.code === item.courseCode);
            if (fullCourse) {
              return {
                ...fullCourse,
                // Override videos to only play the selected video
                videos: [
                  { drive_id: item.driveId, title: item.title, duration_seconds: item.duration },
                ],
              };
            }
            // Fallback if course not found in library
            return {
              code: item.courseCode,
              title: item.courseName,
              videos: [
                { drive_id: item.driveId, title: item.title, duration_seconds: item.duration },
              ],
            };
          })}
          diagnosis={diagnosisData?.diagnosis}
          problemSummary={diagnosisData?.diagnosis?.problem_summary}
          pathSummary={diagnosisData?.pathSummary}
          onComplete={() => {
            clearCart();
            setStage(STAGES.INPUT);
          }}
          onExit={() => setStage(STAGES.DIAGNOSIS)}
        />
      )}
    </div>
  );
}

/**
 * Match courses to the cart based on TRANSCRIPT content (not just tags)
 * Uses a two-pass strategy:
 *   Pass 1: Search with the user's raw query (highest relevancy)
 *   Pass 2: If sparse, broaden with AI diagnosis terms
 */
function matchCoursesToCart(
  cart,
  allCourses,
  selectedTagIds = [],
  errorLog = "",
  semanticResults = []
) {
  if (!allCourses || allCourses.length === 0) return [];

  const userQuery = cart?.userQuery || "";

  // --- Phase 5: Curated Solutions (Priority 0 check) ---
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

  // --- Phase 2: Error Signature Integration ---
  // Auto-detect tags from error text (query + error log)
  const combinedErrorText = `${userQuery} ${errorLog}`.trim();
  const signatureMatches = tagGraphService.matchErrorSignature(combinedErrorText);
  const autoDetectedTagIds = signatureMatches.map((m) => m.tag.tag_id);

  // Merge auto-detected tags with user-selected tags (no duplicates)
  const mergedTagIds = [...new Set([...selectedTagIds, ...autoDetectedTagIds])];

  if (signatureMatches.length > 0) {
    console.log(
      "🔍 Error signatures detected:",
      signatureMatches.map((m) => `${m.tag.display_name} (${m.matchedSignature}, ${m.confidence})`)
    );
  }

  // Extract extra keywords from error log text
  const errorKeywords = errorLog
    .toLowerCase()
    .split(/[\s\n:;,()[\]{}]+/)
    .filter((w) => w.length > 3 && !/^[0-9]+$/.test(w))
    .slice(0, 10);

  // Stopwords to ignore in title matching
  const STOPWORDS = new Set([
    "the",
    "and",
    "for",
    "with",
    "your",
    "first",
    "how",
    "from",
    "this",
    "that",
    "are",
    "was",
    "has",
    "have",
    "not",
    "can",
    "using",
    "into",
    "unreal",
    "engine",
    "introduction",
    "quick",
  ]);

  // Extract meaningful query keywords
  const rawKeywords = userQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  // --- Phase 3: Synonym Expansion ---
  // Expand keywords with synonyms from synonym_map.json
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

  // Helper: match on course title, description, and tags (catches courses missing from search index)
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
          if (title.includes(kw)) {
            score += 50; // Title match is strongest signal
            matchedKeywords.push(kw);
          } else if (allTags.includes(kw)) {
            score += 30; // Exact tag match
            matchedKeywords.push(kw);
          } else if (desc.includes(kw)) {
            score += 10; // Description mentions
            matchedKeywords.push(kw);
          }
        }

        // Keyword coverage bonus: reward matching more unique keywords
        const uniqueMatched = new Set(matchedKeywords).size;
        if (uniqueMatched >= 2) score *= 1 + uniqueMatched * 0.3;

        if (score === 0) return null;
        return {
          ...course,
          _relevanceScore: score,
          _matchedKeywords: matchedKeywords,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b._relevanceScore - a._relevanceScore);
  };

  // Helper: boost score if course tags overlap with user-selected + auto-detected tags
  const applyTagBoost = (courses) => {
    if (mergedTagIds.length === 0) return courses;

    return courses
      .map((course) => {
        const courseTags = (course.extracted_tags || course.tags || [])
          .map((t) => (typeof t === "string" ? t : t.tag_id || t.name || ""))
          .filter(Boolean);

        const hasMatchingTag = courseTags.some((ct) =>
          mergedTagIds.some(
            (st) =>
              ct.toLowerCase().includes(st.toLowerCase()) ||
              st.toLowerCase().includes(ct.toLowerCase())
          )
        );

        return {
          ...course,
          _relevanceScore: hasMatchingTag
            ? course._relevanceScore * 2
            : course._relevanceScore * 0.5,
        };
      })
      .sort((a, b) => b._relevanceScore - a._relevanceScore);
  };

  // Build search query, optionally enriched with error log keywords
  const enrichedQuery =
    errorKeywords.length > 0 ? `${userQuery} ${errorKeywords.join(" ")}` : userQuery;

  // Pass 1: Transcript search (from search index)
  const transcriptResults = searchAndFilter(enrichedQuery);

  // Pass 2: Title/tag/description search (catches courses missing from search index)
  const allQueryKeywords =
    errorKeywords.length > 0 ? [...queryKeywords, ...errorKeywords] : queryKeywords;
  const titleResults = titleAndTagSearch(allQueryKeywords);

  // Merge both passes, de-duplicating by course code
  const seen = new Set();
  const merged = [];

  // Add transcript results first
  for (const r of transcriptResults) {
    if (!seen.has(r.code)) {
      merged.push(r);
      seen.add(r.code);
    }
  }
  // Add title/tag results, boosting if also found in transcript search
  for (const r of titleResults) {
    if (!seen.has(r.code)) {
      merged.push(r);
      seen.add(r.code);
    } else {
      // Combine scores if found in both
      const existing = merged.find((m) => m.code === r.code);
      if (existing) {
        existing._relevanceScore += r._relevanceScore;
      }
    }
  }

  // Pass 2.5: Semantic search — Tier 2 fallback only when Tier 1 confidence is low
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
        // Boost existing result if also semantically similar
        const existing = merged.find((m) => m.code === sr.code);
        if (existing) {
          existing._relevanceScore += sr.similarity * 40;
        }
      }
    }
  } else if (semanticResults.length > 0) {
    console.log(
      `✅ Tier 1: Deterministic match confident (top score: ${tier1TopScore}), skipping semantic`
    );
  }

  // Sort by combined score
  merged.sort((a, b) => b._relevanceScore - a._relevanceScore);

  const boosted = applyTagBoost(merged);
  if (boosted.length >= 3) {
    return applyVersionFilter(boosted.slice(0, 5), userQuery);
  }

  // Pass 3: Broaden with diagnosis terms if still sparse
  const broadParts = [
    enrichedQuery,
    cart?.diagnosis?.problem_summary,
    ...(cart?.intent?.systems || []),
  ].filter(Boolean);
  const broadQuery = broadParts.join(" ");
  const broadKeywords = broadQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const broadTranscript = searchAndFilter(broadQuery);
  const broadTitle = titleAndTagSearch(broadKeywords);

  for (const r of [...broadTranscript, ...broadTitle]) {
    if (!seen.has(r.code)) {
      merged.push(r);
      seen.add(r.code);
    }
  }

  merged.sort((a, b) => b._relevanceScore - a._relevanceScore);
  const boostedBroad = applyTagBoost(merged);
  if (boostedBroad.length >= 3) {
    return applyVersionFilter(boostedBroad.slice(0, 5), userQuery);
  }

  // Fallback: traditional tag graph scoring
  const tagScored = allCourses.map((course) => {
    const score = tagGraphService.scoreCourseRelevance(course, allQueryKeywords);
    return { ...course, _relevanceScore: score };
  });

  const fallbackResults = tagScored
    .filter((c) => c._relevanceScore > 0 && c.videos?.length && c.videos[0]?.drive_id)
    .sort((a, b) => b._relevanceScore - a._relevanceScore)
    .slice(0, 5);

  return applyVersionFilter(applyTagBoost(fallbackResults), userQuery);
}

/**
 * Phase 8A: Version enforcement — adjust scores based on UE version intent.
 * UE4 queries: demote courses with UE5-only tags (Lumen, Nanite, etc.)
 * UE5 queries: boost courses with UE5-only tags
 */
function applyVersionFilter(courses, userQuery) {
  const version = detectUEVersion(userQuery);
  if (!version) return courses; // No version specified, no filtering

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
        // UE4 query but course has UE5-only tags → heavy demotion
        console.log(`⬇️ UE4 demotion: ${course.code} (has UE5-only tags)`);
        return { ...course, _relevanceScore: course._relevanceScore * 0.2 };
      }
      if (version === 5 && hasUE5OnlyTag) {
        // UE5 query + UE5-only tags → boost
        return { ...course, _relevanceScore: course._relevanceScore * 1.5 };
      }
      return course;
    })
    .sort((a, b) => b._relevanceScore - a._relevanceScore);
}
