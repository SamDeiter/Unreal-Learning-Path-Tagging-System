/**
 * ProblemFirst - Main page component for Problem-First Learning
 * Orchestrates: Input → Diagnosis → Learning Cart
 */
import { useState, useCallback, useMemo } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp, getApps } from "firebase/app";
import ProblemInput from "./ProblemInput";
import DiagnosisCard from "./DiagnosisCard";
import AdaptiveLearningCart from "./AdaptiveLearningCart";
import tagGraphService from "../../services/TagGraphService";
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
  ERROR: "error",
};

export default function ProblemFirst() {
  const [stage, setStage] = useState(STAGES.INPUT);
  const [cart, setCart] = useState(null);
  const [error, setError] = useState(null);

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

        // Match courses using TagGraphService
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

  const handleCourseClick = useCallback((course) => {
    // Open course detail or navigate
    if (course.videoUrl || course.url) {
      window.open(course.videoUrl || course.url, "_blank");
    }
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

          {/* Diagnosis Card */}
          <DiagnosisCard diagnosis={cart.diagnosis} />

          {/* Learning Cart */}
          <AdaptiveLearningCart
            objectives={cart.objectives}
            courses={cart.matchedCourses || []}
            validation={cart.validation}
            onCourseClick={handleCourseClick}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Match courses to the cart based on detected tags and systems
 */
function matchCoursesToCart(cart, allCourses) {
  if (!allCourses || allCourses.length === 0) return [];
  if (!cart?.intent?.systems?.length && !cart?.diagnosis) return allCourses.slice(0, 5);

  // Get relevant tag IDs from intent and diagnosis
  const relevantTagIds = new Set();

  // Add systems from intent
  (cart.intent?.systems || []).forEach((sys) => {
    relevantTagIds.add(sys.toLowerCase());
  });

  // Extract keywords from ALL diagnosis fields
  const diagnosisParts = [
    cart.diagnosis?.problem_summary,
    ...(cart.diagnosis?.root_causes || []),
    ...(cart.diagnosis?.signals_to_watch_for || []),
    ...(cart.diagnosis?.variables_that_matter || []),
    ...(cart.diagnosis?.generalization_scope || []),
  ].filter(Boolean);

  const diagnosisText = diagnosisParts.join(" ");

  // Extract tags from diagnosis text
  const extractedTags = tagGraphService.extractTagsFromText(diagnosisText);
  extractedTags.forEach((match) => {
    relevantTagIds.add(match.tag.tag_id);
    // Also add the display name for broader matching
    relevantTagIds.add(match.tag.display_name.toLowerCase());
  });

  // Also extract common UE5 keywords directly from diagnosis text
  const ue5Keywords = [
    "lumen",
    "nanite",
    "blueprint",
    "material",
    "lighting",
    "animation",
    "sequencer",
    "niagara",
    "landscape",
    "foliage",
    "pcg",
    "taa",
    "raytracing",
    "reflection",
    "gi",
    "performance",
    "rendering",
  ];
  const textLower = diagnosisText.toLowerCase();
  ue5Keywords.forEach((kw) => {
    if (textLower.includes(kw)) {
      relevantTagIds.add(kw);
    }
  });

  // Score and rank courses
  const scoredCourses = allCourses.map((course) => {
    const score = tagGraphService.scoreCourseRelevance(course, Array.from(relevantTagIds));
    return { ...course, _relevanceScore: score };
  });

  // Sort by relevance and return top 8 (more options)
  return scoredCourses
    .filter((c) => c._relevanceScore > 0)
    .sort((a, b) => b._relevanceScore - a._relevanceScore)
    .slice(0, 8);
}
