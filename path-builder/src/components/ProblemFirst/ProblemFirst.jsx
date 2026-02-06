/**
 * ProblemFirst - Main page component for Problem-First Learning
 * Orchestrates: Input → Diagnosis → Learning Cart
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp, getApps } from "firebase/app";
import ProblemInput from "./ProblemInput";
import DiagnosisCard from "./DiagnosisCard";
import AdaptiveLearningCart from "./AdaptiveLearningCart";
import GuidedPlayer from "../GuidedPlayer/GuidedPlayer";
import tagGraphService from "../../services/TagGraphService";
import { searchSegments } from "../../services/segmentSearchService";
import {
  trackQuerySubmitted,
  trackDiagnosisGenerated,
  trackLearningPathGenerated,
} from "../../services/analyticsService";
import { useTagData } from "../../context/TagDataContext";
import { formatDuration } from "../../utils/videoUtils";
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

export default function ProblemFirst() {
  const [stage, setStage] = useState(STAGES.INPUT);
  const [cart, setCart] = useState(null);
  const [error, setError] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState([]);

  // Get courses from context using the hook
  const tagData = useTagData();
  const courses = useMemo(() => tagData?.courses || [], [tagData?.courses]);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setSelectedCourses(JSON.parse(stored));
      }
    } catch (e) {
      console.error("[ProblemFirst] Failed to load cart:", e);
    }
  }, []);

  // Save cart to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(selectedCourses));
    } catch (e) {
      console.error("[ProblemFirst] Failed to save cart:", e);
    }
  }, [selectedCourses]);

  // Calculate total duration of selected courses
  const totalDuration = useMemo(() => {
    const totalSec = selectedCourses.reduce((sum, course) => {
      const courseDurationSec =
        course.videos?.reduce((vs, v) => vs + (v.duration_seconds || 0), 0) ||
        (course.duration_minutes || 0) * 60;
      return sum + courseDurationSec;
    }, 0);
    return formatDuration(totalSec);
  }, [selectedCourses]);

  // Add/remove course from cart
  const handleAddToCart = useCallback((course) => {
    setSelectedCourses((prev) => {
      const exists = prev.some((c) => c.code === course.code);
      if (exists) {
        return prev.filter((c) => c.code !== course.code);
      } else {
        return [...prev, course];
      }
    });
  }, []);

  // Check if course is in cart
  const isCourseInCart = useCallback(
    (course) => selectedCourses.some((c) => c.code === course.code),
    [selectedCourses]
  );

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

        // Store original query for transcript search matching
        cartData.userQuery = inputData.query;

        // Match courses using transcript-based search
        const matchedCourses = matchCoursesToCart(cartData, courses);
        cartData.matchedCourses = matchedCourses;

        setCart(cartData);
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

  const handleReset = useCallback(() => {
    setStage(STAGES.INPUT);
    setCart(null);
    setError(null);
  }, []);

  return (
    <div className="problem-first-page">
      {/* Header */}
      <header className="page-header">
        <h1>🔧 Fix a Problem</h1>
        <p>Describe your issue. We'll diagnose the root cause and teach you to solve it forever.</p>
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

      {/* Stage: Diagnosis + Cart */}
      {stage === STAGES.DIAGNOSIS && cart && (
        <div className="diagnosis-results">
          {/* Back button */}
          <button className="back-btn" onClick={handleReset}>
            ← New Problem
          </button>

          {/* HERO: Video Recommendations (TOP) */}
          <div className="hero-videos">
            <h2 className="hero-title">
              🎯 Watch These ({(cart.matchedCourses || []).slice(0, 5).length} segments)
            </h2>
            <div className="hero-video-grid">
              {(cart.matchedCourses || []).slice(0, 5).map((course, idx) => (
                <div key={course.code} className={`hero-video-card ${idx === 0 ? "primary" : ""}`}>
                  <div className="video-thumbnail">
                    {course.videos?.[0]?.drive_id ? (
                      <img
                        src={`https://drive.google.com/thumbnail?id=${course.videos[0].drive_id}&sz=w320`}
                        alt={course.title}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="thumbnail-placeholder">📹</div>
                    )}
                  </div>
                  <div className="video-info">
                    <h3 className="video-title">{course.title || course.code}</h3>
                    <p className="video-meta">
                      {course.duration_formatted || "~10 min"} • {course.video_count || 1} video
                      {(course.video_count || 1) > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="video-actions">
                    <button
                      className={`cta-btn ${idx === 0 ? "primary" : "secondary"}`}
                      onClick={() => {
                        handleAddToCart(course);
                        if (idx === 0) setStage(STAGES.GUIDED);
                      }}
                    >
                      {idx === 0
                        ? "▶ Watch Now"
                        : isCourseInCart(course.code)
                          ? "✓ Added"
                          : "+ Add"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Collapsed Diagnosis (BOTTOM) */}
          <details className="diagnosis-collapsed">
            <summary className="diagnosis-summary">
              📋 Diagnosis ({cart.diagnosis?.root_causes?.length || 0} causes identified)
            </summary>
            <DiagnosisCard diagnosis={cart.diagnosis} />
          </details>

          {/* Cart Summary Panel */}
          {selectedCourses.length > 0 && (
            <div className="cart-panel">
              <h3>🛒 Your Learning Path</h3>
              <div className="cart-stats">
                <span className="stat">
                  <strong>{selectedCourses.length}</strong> courses selected
                </span>
                {totalDuration && (
                  <span className="stat">
                    <strong>{totalDuration}</strong> total
                  </span>
                )}
              </div>
              <div className="cart-courses">
                {selectedCourses.map((course) => (
                  <div key={course.code} className="cart-course-item">
                    <span className="name">{course.title || course.name}</span>
                    <button
                      className="remove-btn"
                      onClick={() => handleAddToCart(course)}
                      aria-label="Remove from path"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button className="generate-path-btn" onClick={() => setStage(STAGES.GUIDED)}>
                Generate Path →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stage: Guided Player */}
      {stage === STAGES.GUIDED && (
        <GuidedPlayer
          courses={selectedCourses}
          diagnosis={cart?.diagnosis}
          problemSummary={cart?.diagnosis?.problem_summary}
          onComplete={() => {
            // Clear cart and return to input
            setSelectedCourses([]);
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
 * Uses word frequency from actual video transcripts for better relevancy
 */
function matchCoursesToCart(cart, allCourses) {
  if (!allCourses || allCourses.length === 0) return [];

  // Build search query from user's problem and diagnosis
  const queryParts = [
    cart?.userQuery,
    cart?.diagnosis?.problem_summary,
    ...(cart?.intent?.systems || []),
  ].filter(Boolean);

  const searchQuery = queryParts.join(" ");

  if (!searchQuery || searchQuery.length < 5) {
    return allCourses.slice(0, 5);
  }

  // Use transcript-based search for MUCH better relevancy
  const transcriptResults = searchSegments(searchQuery, allCourses);

  // Map back to full course objects with scores
  const scoredCourses = transcriptResults
    .map((result) => {
      const course = allCourses.find((c) => c.code === result.courseCode);
      if (!course) return null;
      return {
        ...course,
        _relevanceScore: result.score,
        _matchedKeywords: result.matchedKeywords,
      };
    })
    .filter(Boolean);

  // If transcript search found results, use those
  if (scoredCourses.length >= 3) {
    return scoredCourses.slice(0, 5);
  }

  // Fallback: Use tag-based scoring if transcript search is sparse
  const keywords = searchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const tagScored = allCourses.map((course) => {
    const score = tagGraphService.scoreCourseRelevance(course, keywords);
    return { ...course, _relevanceScore: score };
  });

  return tagScored
    .filter((c) => c._relevanceScore > 0)
    .sort((a, b) => b._relevanceScore - a._relevanceScore)
    .slice(0, 5);
}
