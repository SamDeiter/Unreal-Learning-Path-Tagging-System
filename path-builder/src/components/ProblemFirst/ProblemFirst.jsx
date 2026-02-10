/**
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
import { searchSegmentsSemantic } from "../../services/segmentSearchService";
import { searchDocsSemantic } from "../../services/docsSearchService";
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
  const [expandedVideoId, setExpandedVideoId] = useState(null);

  const { cart, addToCart, removeFromCart, clearCart, isInCart } = useVideoCart();
  const tagData = useTagData();
  const courses = useMemo(() => tagData?.courses || [], [tagData?.courses]);

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
        await trackQuerySubmitted(
          inputData.query,
          inputData.detectedTagIds,
          getDetectedPersona()?.id
        );

        const app = getFirebaseApp();
        const functions = getFunctions(app, "us-central1");

        // Step 1: Get query embedding (used for both course + segment search)
        let queryEmbedding = null;
        let semanticResults = [];
        let retrievedPassages = [];
        try {
          const embedQuery = httpsCallable(functions, "embedQuery");
          const embedResult = await embedQuery({ query: inputData.query });
          if (embedResult.data?.success && embedResult.data?.embedding) {
            queryEmbedding = embedResult.data.embedding;
            // Course-level semantic search (existing)
            semanticResults = findSimilarCourses(queryEmbedding, 8, 0.35);
            // Passage-level semantic search (RAG upgrade)
            try {
              // Search transcripts
              const segResults = await searchSegmentsSemantic(queryEmbedding, 6, 0.35);
              const segPassages = segResults.map((s) => ({
                text: s.previewText,
                courseCode: s.courseCode,
                videoTitle: s.videoTitle,
                timestamp: s.timestamp,
                similarity: s.similarity,
                source: "transcript",
              }));

              // Search Epic docs
              let docPassages = [];
              try {
                const docResults = await searchDocsSemantic(queryEmbedding, 3, 0.35);
                docPassages = docResults.map((d) => ({
                  text: d.previewText,
                  url: d.url,
                  title: d.title,
                  section: d.section,
                  similarity: d.similarity,
                  source: "epic_docs",
                }));
              } catch (docErr) {
                console.warn("⚠️ Docs semantic search skipped:", docErr.message);
              }

              retrievedPassages = [...segPassages, ...docPassages];
              console.log(
                `[RAG] Retrieved ${segPassages.length} transcript + ${docPassages.length} doc passages`
              );
            } catch (segErr) {
              console.warn("⚠️ Segment semantic search skipped:", segErr.message);
            }
          }
        } catch (semanticErr) {
          console.warn("⚠️ Semantic search skipped:", semanticErr.message);
        }

        // Step 2: Call Cloud Function with retrieved context
        const queryLearningPath = httpsCallable(functions, "queryLearningPath");
        const result = await queryLearningPath({
          query: inputData.query,
          mode: "problem-first",
          detectedTagIds: inputData.detectedTagIds,
          personaHint: inputData.personaHint,
          retrievedContext: retrievedPassages.slice(0, 5), // Top 5 passages
        });

        if (!result.data.success) throw new Error(result.data.message || "Failed to process query");

        const cartData = result.data.cart;
        cartData.userQuery = inputData.query;
        cartData.retrievedPassages = retrievedPassages; // Store for UI display

        // Match courses (extracted to domain/courseMatching.js)
        const matchedCourses = matchCoursesToCart(
          cartData,
          courses,
          inputData.selectedTagIds || [],
          inputData.errorLog || "",
          semanticResults
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
        setDiagnosisData(cartData);
        // Auto-expand the first (most relevant) video card
        if (videos.length > 0) setExpandedVideoId(videos[0].driveId);

        setStage(STAGES.DIAGNOSIS);
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

  const handleAskAgain = useCallback(() => setStage(STAGES.INPUT), []);

  const handleReset = useCallback(() => {
    setStage(STAGES.INPUT);
    setDiagnosisData(null);
    setVideoResults([]);
    setExpandedVideoId(null);
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
          <button className="retry-btn" onClick={handleReset}>
            Try Again
          </button>
        </div>
      )}

      {stage === STAGES.DIAGNOSIS && diagnosisData && (
        <div className="shopping-layout">
          <div className="results-column">
            {diagnosisData.diagnosis?.problem_summary && (
              <div className="tldr-diagnosis">
                <span className="tldr-icon">💡</span>
                <p className="tldr-text">{diagnosisData.diagnosis.problem_summary}</p>
              </div>
            )}

            {/* 🎬 Videos for You */}
            <h2 className="results-title">🎬 Videos for You ({videoResults.length})</h2>
            <div className="video-results-grid">
              {videoResults.map((video) => (
                <div key={video.driveId} className={`video-result-wrapper ${expandedVideoId === video.driveId ? "expanded" : ""}`} id={`video-${video.driveId}`}>
                  <VideoResultCard
                    video={video}
                    isAdded={isInCart(video.driveId)}
                    onToggle={handleVideoToggle}
                    userQuery={diagnosisData?.userQuery || ""}
                    isExpanded={expandedVideoId === video.driveId}
                    onExpand={(id) => setExpandedVideoId(expandedVideoId === id ? null : id)}
                    microLesson={diagnosisData.microLesson}
                    retrievedPassages={diagnosisData.retrievedPassages}
                  />
                </div>
              ))}
              {videoResults.length === 0 && (
                <div className="no-results">
                  <p>No matching videos found. Try rephrasing your question.</p>
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className="results-actions-bottom">
              <button className="back-btn" onClick={handleReset}>
                ← Start Over
              </button>
              <button className="ask-again-btn" onClick={handleAskAgain}>
                + Ask Another Question
              </button>
            </div>
          </div>

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

      {stage === STAGES.GUIDED && (
        <GuidedPlayer
          courses={cart.map((item) => {
            const fullCourse = courses.find((c) => c.code === item.courseCode);
            if (fullCourse) {
              return {
                ...fullCourse,
                videos: [
                  { drive_id: item.driveId, title: item.title, duration_seconds: item.duration },
                ],
              };
            }
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
          microLesson={diagnosisData?.microLesson}
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
