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
import { searchSegments, estimateTopSegment } from "../../services/segmentSearchService";
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

/**
 * Flatten matched courses into individual video items for the shopping cart.
 * Each video becomes a separate browseable result.
 */
function flattenCoursesToVideos(matchedCourses, userQuery) {
  const videos = [];
  for (const course of matchedCourses) {
    const courseVideos = course.videos || [];
    if (courseVideos.length === 0) continue;

    // Score each video by title relevance to the query
    const queryWords = (userQuery || "").toLowerCase().split(/\s+/).filter(Boolean);

    for (let i = 0; i < courseVideos.length; i++) {
      const v = courseVideos[i];
      if (!v.drive_id) continue;

      const videoTitle = v.title || v.name || `Video ${i + 1}`;
      const titleLower = videoTitle.toLowerCase();

      // Simple title relevance: boost videos whose title matches query words
      const titleMatches = queryWords.filter((w) => titleLower.includes(w)).length;
      const isIntro = titleLower.includes("intro") || titleLower.includes("overview");

      // Estimate relevant timestamp
      const segment = estimateTopSegment(course.code, queryWords);
      const timestampHint = segment?.estimatedStart
        ? `~${Math.floor(segment.estimatedStart / 60)}:${String(Math.round(segment.estimatedStart % 60)).padStart(2, "0")}`
        : null;

      videos.push({
        driveId: v.drive_id,
        title: videoTitle.replace(/\.mp4$/i, "").replace(/_/g, " "),
        duration: v.duration_seconds || 0,
        courseCode: course.code,
        courseName: course.title || course.code,
        matchedTags: (course._matchedKeywords || []).slice(0, 3),
        videoIndex: i,
        titleRelevance: titleMatches,
        isIntro,
        timestampHint,
        watchHint: timestampHint ? `📍 Relevant section ${timestampHint}` : "▶ Watch full video",
      });
    }
  }

  // Sort: title-relevant first, intros last
  videos.sort((a, b) => {
    if (b.titleRelevance !== a.titleRelevance) return b.titleRelevance - a.titleRelevance;
    if (a.isIntro !== b.isIntro) return a.isIntro ? 1 : -1;
    return 0;
  });

  return videos.slice(0, 10); // Cap at 10 results
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

        // Match courses using transcript-based search
        const matchedCourses = matchCoursesToCart(cartData, courses);
        cartData.matchedCourses = matchedCourses;

        // Flatten to individual videos
        const videos = flattenCoursesToVideos(matchedCourses, inputData.query);
        setVideoResults(videos);
        setDiagnosisData(cartData);

        // Track search history for multi-query support
        setSearchHistory((prev) => [
          { query: inputData.query, resultCount: videos.length },
          ...prev,
        ]);

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
        <>
          <ProblemInput
            onSubmit={handleSubmit}
            detectedPersona={getDetectedPersona()}
            isLoading={stage === STAGES.LOADING}
          />
          {/* Show cart even during input if it has items */}
          {cart.length > 0 && (
            <div className="input-cart-preview">
              <CartPanel
                cart={cart}
                onRemove={removeFromCart}
                onClear={clearCart}
                onWatchPath={handleWatchPath}
              />
            </div>
          )}
        </>
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
                  />
                  <span className="watch-hint">{video.watchHint}</span>
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
function matchCoursesToCart(cart, allCourses) {
  if (!allCourses || allCourses.length === 0) return [];

  const userQuery = cart?.userQuery || "";

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

  // Pass 1: Search with raw user query only (best relevancy)
  const directResults = searchAndFilter(userQuery);
  if (directResults.length >= 3) {
    return directResults.slice(0, 5);
  }

  // Pass 2: Broaden with diagnosis terms if direct search is sparse
  const broadParts = [
    userQuery,
    cart?.diagnosis?.problem_summary,
    ...(cart?.intent?.systems || []),
  ].filter(Boolean);
  const broadQuery = broadParts.join(" ");

  const broadResults = searchAndFilter(broadQuery);

  // Merge: direct results first (higher trust), then broad results
  const seen = new Set(directResults.map((c) => c.code));
  const merged = [...directResults];
  for (const result of broadResults) {
    if (!seen.has(result.code)) {
      merged.push(result);
      seen.add(result.code);
    }
  }

  if (merged.length >= 3) {
    return merged.slice(0, 5);
  }

  // Fallback: Use tag-based scoring if transcript search is sparse
  const keywords = broadQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const tagScored = allCourses.map((course) => {
    const score = tagGraphService.scoreCourseRelevance(course, keywords);
    return { ...course, _relevanceScore: score };
  });

  return tagScored
    .filter((c) => c._relevanceScore > 0 && c.videos?.length && c.videos[0]?.drive_id)
    .sort((a, b) => b._relevanceScore - a._relevanceScore)
    .slice(0, 5);
}
