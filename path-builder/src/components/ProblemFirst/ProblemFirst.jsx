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
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getFirebaseApp } from "../../services/firebaseConfig";
import ProblemInput from "./ProblemInput";
import GuidedPlayer from "../GuidedPlayer/GuidedPlayer";
import VideoResultCard from "../VideoResultCard/VideoResultCard";
import CartPanel from "../CartPanel/CartPanel";
import { useVideoCart } from "../../hooks/useVideoCart";
import { matchCoursesToCart } from "../../domain/courseMatching";
import { flattenCoursesToVideos } from "../../domain/videoRanking";
import { findSimilarCourses } from "../../services/semanticSearchService";
import { searchSegmentsHybrid } from "../../services/segmentSearchService";
import { searchDocsSemantic } from "../../services/docsSearchService";
import { buildLearningPath } from "../../services/PathBuilder";
import { buildBlendedPath } from "../../services/coverageAnalyzer";
import {
  trackQuerySubmitted,
  trackDiagnosisGenerated,
  trackLearningPathGenerated,
} from "../../services/analyticsService";
import { useTagData } from "../../context/TagDataContext";
import { CaseReportForm, ClarifyStep, AnswerView } from "../FixProblem";
import "./ProblemFirst.css";

import { devLog, devWarn } from "../../utils/logger";

const STAGES = {
  INPUT: "input",
  LOADING: "loading",
  CLARIFYING: "clarifying",
  ANSWERED: "answered",
  DIAGNOSIS: "diagnosis",
  GUIDED: "guided",
  ERROR: "error",
};

export default function ProblemFirst() {
  const [stage, setStage] = useState(STAGES.INPUT);
  const [diagnosisData, setDiagnosisData] = useState(null);
  const [error, setError] = useState(null);
  const [blendedPath, setBlendedPath] = useState(null);
  const [videoResults, setVideoResults] = useState([]);
  const [answerData, setAnswerData] = useState(null);
  const [clarifyData, setClarifyData] = useState(null);
  const [caseReport, setCaseReport] = useState(null);
  const [isRerunning, setIsRerunning] = useState(false);
  const [lastInputData, setLastInputData] = useState(null);

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
    async (inputData, overrideCaseReport) => {
      clearCart();
      setStage(STAGES.LOADING);
      setError(null);
      setAnswerData(null);
      setClarifyData(null);
      setLastInputData(inputData);

      // Use override caseReport (from clarification or feedback rerun) or current state
      const activeCaseReport = overrideCaseReport || caseReport;

      if (inputData.pastedImage) {
        devLog("[ProblemFirst] Screenshot attached (base64 length):", inputData.pastedImage.length);
      }
      if (inputData.errorLog) {
        devLog("[ProblemFirst] Error log attached:", inputData.errorLog.slice(0, 200));
      }

      try {
        // ─── Cache-first: check Firestore for cached cart ───
        if (inputData.cachedCartId) {
          devLog(`[Cache] Checking Firestore for cart: ${inputData.cachedCartId}`);
          try {
            const app = getFirebaseApp();
            const db = getFirestore(app);
            const cartRef = doc(db, "adaptive_carts", inputData.cachedCartId);
            const cartSnap = await getDoc(cartRef);

            if (cartSnap.exists()) {
              const cachedCart = cartSnap.data();

              // Check 24h TTL
              const cachedAt =
                cachedCart.cached_at?.toDate?.() || new Date(cachedCart.created_at || 0);
              const ageMs = Date.now() - cachedAt.getTime();
              const TTL_MS = 24 * 60 * 60 * 1000;

              if (ageMs < TTL_MS) {
                devLog(
                  `[Cache Hit] Cart is ${Math.round(ageMs / 60000)}min old — using cached result`
                );

                const cartData = {
                  ...cachedCart,
                  userQuery: inputData.query,
                  retrievedPassages: [],
                };

                // Re-run local matching (no Gemini calls)
                const matchedCourses = await matchCoursesToCart(
                  cartData,
                  courses,
                  inputData.selectedTagIds || [],
                  inputData.errorLog || "",
                  []
                );
                cartData.matchedCourses = matchedCourses;

                const matchedTagIds = [
                  ...(cartData.diagnosis?.matched_tag_ids || []),
                  ...(inputData.detectedTagIds || []),
                  ...(inputData.selectedTagIds || []),
                ];
                const pathResult = buildLearningPath(matchedCourses, matchedTagIds, {
                  preferTroubleshooting: true,
                  diversity: true,
                  timeBudgetMinutes: 300,
                });

                const roleMap = {};
                for (const item of pathResult.path) {
                  roleMap[item.course.code] = {
                    role: item.role,
                    reason: item.reason,
                    estimatedMinutes: item.estimatedMinutes,
                  };
                }

                const videos = await flattenCoursesToVideos(
                  matchedCourses,
                  inputData.query,
                  roleMap
                );

                if (videos.length > 0) {
                  setVideoResults(videos);
                  setDiagnosisData(cartData);
                  setStage(STAGES.DIAGNOSIS);
                  devLog(
                    `[Cache] Loaded ${videos.length} videos from cached cart — 0 Gemini calls`
                  );
                  return;
                }
                devWarn(
                  "[Cache] Cached cart produced 0 videos — falling through to fresh diagnosis"
                );
              } else {
                devLog(`[Cache Expired] Cart is ${Math.round(ageMs / 3600000)}h old — refreshing`);
              }
            } else {
              devLog(`[Cache Miss] Cart ${inputData.cachedCartId} not found in Firestore`);
            }
          } catch (cacheErr) {
            devWarn("[Cache Error] Falling through to fresh diagnosis:", cacheErr.message);
          }
        }

        // ─── Fresh diagnosis: full Gemini pipeline ───
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

            // Run all three searches in parallel (no dependencies between them)
            const [courseResult, segResult, docResult] = await Promise.allSettled([
              findSimilarCourses(queryEmbedding, 8, 0.35),
              searchSegmentsHybrid(inputData.query, queryEmbedding, [], 8),
              searchDocsSemantic(queryEmbedding, 6, 0.35),
            ]);

            // Course-level semantic search
            if (courseResult.status === "fulfilled") {
              semanticResults = courseResult.value;
            } else {
              devWarn("⚠️ Course semantic search failed:", courseResult.reason?.message);
            }

            // Passage-level: transcript segments
            if (segResult.status === "fulfilled") {
              const segPassages = segResult.value.map((s) => ({
                text: s.previewText,
                courseCode: s.courseCode,
                videoTitle: s.videoTitle,
                timestamp: s.timestamp,
                similarity: s.similarity,
                source: "transcript",
              }));
              retrievedPassages.push(...segPassages);
              devLog(`[RAG] ${segPassages.length} transcript passages`);
            } else {
              devWarn("⚠️ Segment search failed:", segResult.reason?.message);
            }

            // Passage-level: Epic docs
            if (docResult.status === "fulfilled") {
              const docPassages = docResult.value.map((d) => ({
                text: d.previewText,
                url: d.url,
                title: d.title,
                section: d.section,
                similarity: d.similarity,
                source: "epic_docs",
              }));
              retrievedPassages.push(...docPassages);
              devLog(`[RAG] ${docPassages.length} doc passages`);
            } else {
              devWarn("⚠️ Docs search failed:", docResult.reason?.message);
            }

            // ── Phase 1: rank all passages by similarity, deduplicate, then slice ──
            retrievedPassages.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
            const seen = new Set();
            retrievedPassages = retrievedPassages.filter((p) => {
              const key = (p.text || "").trim().toLowerCase().slice(0, 120);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            devLog(`[RAG] Total: ${retrievedPassages.length} passages after rank+dedup (parallel)`);
          }
        } catch (semanticErr) {
          devWarn("⚠️ Semantic search skipped:", semanticErr.message);
        }

        // Step 2: Call Cloud Function with retrieved context
        let cartData;
        let geminiSucceeded = true;
        try {
          const queryLearningPath = httpsCallable(functions, "queryLearningPath");
          const result = await queryLearningPath({
            query: inputData.query,
            mode: "problem-first",
            detectedTagIds: inputData.detectedTagIds,
            personaHint: inputData.personaHint,
            retrievedContext: retrievedPassages.slice(0, 8),
            caseReport: activeCaseReport || undefined,
          });

          // Handle off-topic rejection
          if (!result.data.success && result.data.error === "off_topic") {
            setError(
              result.data.message ||
                "This doesn't appear to be a UE5 question. Please describe a specific Unreal Engine 5 issue."
            );
            setStage(STAGES.ERROR);
            return;
          }

          // Handle NEEDS_CLARIFICATION response
          if (result.data.responseType === "NEEDS_CLARIFICATION") {
            setClarifyData({
              question: result.data.question,
              options: result.data.options || [],
              whyAsking: result.data.whyAsking || "",
              query: result.data.query,
              caseReport: result.data.caseReport,
            });
            setStage(STAGES.CLARIFYING);
            return;
          }

          if (!result.data.success)
            throw new Error(result.data.message || "Failed to process query");

          // Store answer-first data for ANSWERED stage
          if (result.data.responseType === "ANSWER") {
            setAnswerData({
              mostLikelyCause: result.data.mostLikelyCause,
              confidence: result.data.confidence,
              fastChecks: result.data.fastChecks || [],
              fixSteps: result.data.fixSteps || [],
              ifStillBrokenBranches: result.data.ifStillBrokenBranches || [],
              whyThisResult: result.data.whyThisResult || [],
              evidence: result.data.evidence || [],
              learnPath: result.data.learnPath,
            });
          }

          cartData = result.data.cart;
        } catch (geminiErr) {
          // Graceful fallback on 429 or other Gemini errors — use local-only matching
          const is429 =
            geminiErr.message?.includes("429") || geminiErr.code === "resource-exhausted";
          const isOffTopic =
            geminiErr.message?.includes("off_topic") || geminiErr.message?.includes("not a UE5");

          if (isOffTopic) {
            setError(
              "This doesn't appear to be a UE5 question. Try describing a specific Unreal Engine 5 issue, for example:\n" +
                '• "Lumen reflections flickering"\n' +
                '• "Blueprint compile error"\n' +
                '• "Niagara particles not spawning"'
            );
            setStage(STAGES.ERROR);
            return;
          }

          devWarn(
            `⚠️ Gemini ${is429 ? "rate limited (429)" : "error"}: ${geminiErr.message}. Falling back to local matching.`
          );
          geminiSucceeded = false;
          cartData = {
            diagnosis: {
              problem_summary: inputData.query,
              matched_tag_ids: inputData.detectedTagIds || [],
            },
            objectives: [],
            intent: { systems: [] },
          };
        }
        cartData.userQuery = inputData.query;
        cartData.retrievedPassages = retrievedPassages; // Store for UI display
        cartData._localFallback = !geminiSucceeded; // Flag for UI to show fallback notice

        // Match courses (extracted to domain/courseMatching.js)
        const matchedCourses = await matchCoursesToCart(
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
          timeBudgetMinutes: 300,
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
        const allItems = await flattenCoursesToVideos(matchedCourses, inputData.query, roleMap);

        // Separate Drive videos from doc/YouTube items
        // Doc/YT items flow into the blended path sections below; only Drive videos go into "Videos for You"
        const driveVideos = allItems.filter((v) => !v.type || v.type === "video");
        const nonVideoItems = allItems.filter((v) => v.type === "doc" || v.type === "youtube");

        if (allItems.length === 0) {
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

        setVideoResults(driveVideos);
        setDiagnosisData(cartData);

        // Build blended path (docs + YouTube gap-fillers)
        try {
          const rawTags = [
            ...(cartData.diagnosis?.matched_tag_ids || []),
            ...(inputData.detectedTagIds || []),
          ];
          // Split dotted tag IDs into individual segments for YouTube matching
          const tagSegments = rawTags.flatMap((t) =>
            t.split(/[._]/).filter((s) => s.length > 2 && s !== "unreal" && s !== "engine")
          );

          // Doc topics: use ONLY user query words + augmentation (not tag segments,
          // which inject noise like "rendering"/"meshDistanceField" and boost wrong docs)
          const STOP_WORDS = new Set([
            "the",
            "and",
            "for",
            "are",
            "but",
            "not",
            "you",
            "all",
            "can",
            "has",
            "her",
            "was",
            "one",
            "our",
            "out",
            "its",
            "how",
            "why",
            "with",
            "from",
            "they",
            "been",
            "have",
            "this",
            "that",
            "what",
            "when",
            "your",
            "into",
          ]);
          const queryWords = (inputData.query || "")
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
          const docTopics = [...new Set(queryWords)];

          // Topic augmentation: add common related terms that users imply but don't type
          const hasWord = (w) => docTopics.some((t) => t.includes(w));
          if (hasWord("mesh") && !hasWord("skeletal")) {
            docTopics.push("static mesh", "static meshes", "import", "importing");
          }
          if (hasWord("size") || hasWord("scale") || hasWord("wrong")) {
            docTopics.push("scale", "transform");
          }

          // YouTube topics: combine both tag segments and query words
          const uniqueTopics = [...new Set([...tagSegments, ...docTopics])].slice(0, 15);

          devLog(`[DocTopics] ${docTopics.join(", ")}`);
          devLog(`[AllTopics] ${uniqueTopics.join(", ")}`);

          if (docTopics.length > 0) {
            const blended = await buildBlendedPath(docTopics, driveVideos, {
              maxDocs: 5,
              maxYoutube: 3,
            });
            // Merge any non-video items from matching into the blended path
            if (nonVideoItems.length > 0) {
              for (const nv of nonVideoItems) {
                if (nv.type === "doc" && !blended.docs.some((d) => d.url === nv._externalUrl)) {
                  blended.docs.push({
                    label: nv.title,
                    url: nv._externalUrl || nv.url,
                    description: nv.description || "",
                    readTimeMinutes: nv.readTimeMinutes || 10,
                    tier: "intermediate",
                  });
                }
                if (
                  nv.type === "youtube" &&
                  !blended.youtube.some((y) => y.url === nv._externalUrl)
                ) {
                  blended.youtube.push({
                    title: nv.title,
                    url: nv._externalUrl || nv.url,
                    channelName: nv.channel || "YouTube",
                    channelTrust: nv.channelTrust || null,
                    durationMinutes: nv.durationMinutes || 10,
                    tier: "intermediate",
                  });
                }
              }
            }
            // Sort docs by raw relevance so the best match appears first
            blended.docs.sort(
              (a, b) => (b._rawScore ?? b.matchScore ?? 0) - (a._rawScore ?? a.matchScore ?? 0)
            );
            setBlendedPath(blended);
            devLog(
              `[Blended] ${blended.docs.length} docs, ${blended.youtube.length} YT, coverage: ${(blended.coverageScore * 100).toFixed(0)}%`
            );
          }
        } catch (blendedErr) {
          devWarn("⚠️ Blended path skipped:", blendedErr.message);
        }

        // If we have answer-first data, show ANSWERED stage first; otherwise go straight to DIAGNOSIS (backward compat)
        setStage(answerData ? STAGES.ANSWERED : STAGES.DIAGNOSIS);

        // Update history with cart_id so future clicks use cache
        if (inputData.updateCartIdForQuery && cartData.cart_id) {
          inputData.updateCartIdForQuery(inputData.query, cartData.cart_id);
          devLog(
            `[Cache] Saved cart_id ${cartData.cart_id} to history for: "${inputData.query.substring(0, 40)}..."`
          );
        }

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
    [courses, getDetectedPersona, clearCart, caseReport, answerData]
  );

  const handleAskAgain = useCallback(() => setStage(STAGES.INPUT), []);

  const handleReset = useCallback(() => {
    setStage(STAGES.INPUT);
    setDiagnosisData(null);
    setVideoResults([]);
    setError(null);
    setBlendedPath(null);
    setAnswerData(null);
    setClarifyData(null);
    setCaseReport(null);
    setIsRerunning(false);
  }, []);

  // Handle clarification answer — re-submit with extra context
  const handleClarifyAnswer = useCallback(
    (answer) => {
      if (!lastInputData) return;
      const augmentedInput = {
        ...lastInputData,
        query: `${lastInputData.query} (${answer})`,
      };
      handleSubmit(augmentedInput, caseReport);
    },
    [lastInputData, caseReport, handleSubmit]
  );

  // Handle clarification skip — force best-effort answer
  const handleClarifySkip = useCallback(() => {
    if (!lastInputData) return;
    handleSubmit(lastInputData, caseReport);
  }, [lastInputData, caseReport, handleSubmit]);

  // Handle feedback from AnswerView
  const handleFeedback = useCallback(
    (feedback) => {
      if (feedback.solved) {
        devLog("[Feedback] User confirmed solution worked");
        return;
      }
      // Re-run with exclusions
      if (!lastInputData) return;
      setIsRerunning(true);
      const updatedCase = {
        ...(caseReport || {}),
        exclusions: [
          ...((caseReport || {}).exclusions || []),
          feedback.reason || "Previous solution did not work",
        ],
      };
      setCaseReport(updatedCase);
      handleSubmit(lastInputData, updatedCase);
    },
    [lastInputData, caseReport, handleSubmit]
  );

  // Navigate from ANSWERED to DIAGNOSIS (video browsing)
  const handleBackToVideos = useCallback(() => {
    setStage(STAGES.DIAGNOSIS);
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
        <p>Describe your issue. We&apos;ll diagnose it and show you how to fix it.</p>
      </header>

      {(stage === STAGES.INPUT || stage === STAGES.LOADING) && (
        <>
          <ProblemInput
            onSubmit={handleSubmit}
            detectedPersona={getDetectedPersona()}
            isLoading={stage === STAGES.LOADING}
          />
          <CaseReportForm onUpdate={setCaseReport} disabled={stage === STAGES.LOADING} />
        </>
      )}

      {stage === STAGES.CLARIFYING && clarifyData && (
        <ClarifyStep
          question={clarifyData.question}
          options={clarifyData.options}
          whyAsking={clarifyData.whyAsking}
          onAnswer={handleClarifyAnswer}
          onSkip={handleClarifySkip}
          isLoading={false}
        />
      )}

      {stage === STAGES.ANSWERED && answerData && (
        <AnswerView
          answer={answerData}
          onFeedback={handleFeedback}
          onBackToVideos={handleBackToVideos}
          onStartOver={handleReset}
          isRerunning={isRerunning}
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
            <div className="tldr-diagnosis">
              <div className="tldr-user-query">
                <span className="tldr-query-label">🔍 You asked:</span>
                <p className="tldr-query-text">{diagnosisData.userQuery}</p>
              </div>
              {diagnosisData._localFallback && (
                <div
                  className="tldr-fallback-notice"
                  style={{
                    background: "rgba(255, 193, 7, 0.1)",
                    border: "1px solid rgba(255, 193, 7, 0.3)",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    margin: "8px 0",
                    fontSize: "0.85rem",
                    color: "var(--text-muted, #aaa)",
                  }}
                >
                  ⚡ <strong>Fast results</strong> — AI diagnosis temporarily unavailable. Videos
                  matched by tag taxonomy. Try again in a moment for AI-powered results.
                </div>
              )}
              {diagnosisData.diagnosis?.problem_summary && (
                <p className="tldr-bridge">
                  Based on your question, we think these videos will help you:
                </p>
              )}
            </div>

            {/* 🎬 Videos for You — Grouped by Role */}
            <h2 className="results-title">🎬 Videos for You ({videoResults.length})</h2>

            {videoResults.length === 0 && (
              <div className="no-results">
                <p>No matching videos found. Try rephrasing your question.</p>
              </div>
            )}

            {(() => {
              const ROLE_SECTIONS = [
                {
                  key: "prerequisite",
                  icon: "🔗",
                  label: "Prerequisite",
                  desc: "Build the foundation first — these cover concepts you'll need before tackling the main topic.",
                },
                {
                  key: "core",
                  icon: "⭐",
                  label: "Core",
                  desc: "These directly address your question and are the most important videos to watch.",
                },
                {
                  key: "troubleshooting",
                  icon: "🔧",
                  label: "Troubleshooting",
                  desc: "Debugging helpers — watch these if you're hitting errors or unexpected behavior.",
                },
                {
                  key: "supplemental",
                  icon: "📚",
                  label: "Supplemental",
                  desc: "Go deeper — extra context and advanced techniques for when you're ready.",
                },
              ];

              const grouped = {};
              for (const section of ROLE_SECTIONS) grouped[section.key] = [];
              grouped._other = [];

              for (const video of videoResults) {
                const role = video.role || "_other";
                (grouped[role] || grouped._other).push(video);
              }

              return ROLE_SECTIONS.filter((s) => grouped[s.key].length > 0)
                .map((section) => (
                  <div key={section.key} className="role-section">
                    <div className="role-section-header">
                      <h3 className="role-section-title">
                        {section.icon} {section.label}
                        <span className="role-section-count">{grouped[section.key].length}</span>
                      </h3>
                      <p className="role-section-desc">{section.desc}</p>
                    </div>
                    <div className="video-results-grid">
                      {grouped[section.key].map((video) => (
                        <div
                          key={video.driveId}
                          className="video-result-wrapper"
                          id={`video-${video.driveId}`}
                        >
                          <VideoResultCard
                            video={video}
                            isAdded={isInCart(video.driveId)}
                            onToggle={handleVideoToggle}
                            userQuery={diagnosisData?.userQuery || ""}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
                .concat(
                  grouped._other.length > 0
                    ? [
                        <div key="_other" className="role-section">
                          <div className="role-section-header">
                            <h3 className="role-section-title">
                              📎 Related{" "}
                              <span className="role-section-count">{grouped._other.length}</span>
                            </h3>
                            <p className="role-section-desc">
                              Additional videos that may be relevant to your query.
                            </p>
                          </div>
                          <div className="video-results-grid">
                            {grouped._other.map((video) => (
                              <div
                                key={video.driveId}
                                className="video-result-wrapper"
                                id={`video-${video.driveId}`}
                              >
                                <VideoResultCard
                                  video={video}
                                  isAdded={isInCart(video.driveId)}
                                  onToggle={handleVideoToggle}
                                  userQuery={diagnosisData?.userQuery || ""}
                                />
                              </div>
                            ))}
                          </div>
                        </div>,
                      ]
                    : []
                );
            })()}

            {/* 📚 Recommended Reading — Official Epic Docs */}
            {blendedPath?.docs?.length > 0 && (
              <div className="blended-section">
                <div className="blended-section-header">
                  <h2 className="blended-section-title">📚 Recommended Reading</h2>
                  <p className="blended-section-desc">
                    Official Unreal Engine documentation to deepen your understanding.
                    {blendedPath.docs.reduce((sum, d) => sum + (d.readTimeMinutes || 10), 0) > 0 &&
                      ` (~${blendedPath.docs.reduce((sum, d) => sum + (d.readTimeMinutes || 10), 0)} min total read time)`}
                  </p>
                </div>
                <div className="doc-cards-grid">
                  {blendedPath.docs.map((doc, i) => {
                    const docId = `doc_${doc.key || i}`;
                    const inCart = isInCart(docId);
                    return (
                      <div
                        key={doc.key || i}
                        className={`doc-card ${inCart ? "doc-card-added" : ""}`}
                      >
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="doc-card-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="doc-card-header">
                            {doc.matchScore != null &&
                              (() => {
                                const tier =
                                  doc.matchScore >= 90
                                    ? "best"
                                    : doc.matchScore >= 60
                                      ? "strong"
                                      : doc.matchScore >= 30
                                        ? "good"
                                        : "related";
                                const label =
                                  doc.matchScore >= 90
                                    ? "Best Match"
                                    : doc.matchScore >= 60
                                      ? "Strong"
                                      : doc.matchScore >= 30
                                        ? "Good"
                                        : "Related";
                                return (
                                  <span
                                    className={`doc-match-badge doc-match-${tier}`}
                                    title={`${doc.matchScore}% relevancy`}
                                  >
                                    <span className="doc-match-dot" />
                                    {label}
                                  </span>
                                );
                              })()}
                            <span className={`tier-badge tier-${doc.tier || "intermediate"}`}>
                              {doc.tier || "intermediate"}
                            </span>
                            {doc.subsystem && (
                              <span className="subsystem-tag">{doc.subsystem}</span>
                            )}
                          </div>
                          <h4 className="doc-card-title">{doc.label}</h4>
                          {doc.description && <p className="doc-card-desc">{doc.description}</p>}
                          <div className="doc-card-footer">
                            <span className="doc-source-badge">📄 Epic Docs</span>
                            <span className="doc-read-time">
                              {doc.readTimeMinutes || 10} min read
                            </span>
                          </div>
                        </a>
                        <button
                          className={`doc-add-btn ${inCart ? "doc-added" : ""}`}
                          onClick={() => {
                            if (inCart) {
                              removeFromCart(docId);
                            } else {
                              addToCart({
                                type: "doc",
                                itemId: docId,
                                title: doc.label,
                                description: doc.description || "",
                                keySteps: doc.keySteps || [],
                                seeAlso: doc.seeAlso || [],
                                sections: doc.sections || [],
                                url: doc.url,
                                tier: doc.tier || "intermediate",
                                subsystem: doc.subsystem,
                                readTimeMinutes: doc.readTimeMinutes || 10,
                              });
                            }
                          }}
                          title={inCart ? "Remove from path" : "Add to learning path"}
                        >
                          {inCart ? "✓ Added" : "➕ Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 📺 Official Epic YouTube */}
            {blendedPath?.youtube?.length > 0 && (
              <div className="blended-section">
                <div className="blended-section-header">
                  <h2 className="blended-section-title">📺 Official Epic YouTube</h2>
                  <p className="blended-section-desc">
                    Official Unreal Engine tutorials from Epic Games.
                  </p>
                </div>
                <div className="doc-cards-grid">
                  {blendedPath.youtube.map((yt) => {
                    const ytId = yt.id || `yt_${yt.url}`;
                    const inCart = isInCart(ytId);
                    return (
                      <div
                        key={yt.id}
                        className={`doc-card yt-card-with-thumb ${inCart ? "doc-card-added" : ""}`}
                      >
                        <a
                          href={yt.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="doc-card-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(() => {
                            const vidMatch = yt.url?.match(/[?&]v=([^&]+)/);
                            const vidId = vidMatch ? vidMatch[1] : null;
                            return vidId ? (
                              <div className="yt-thumb-wrapper">
                                <img
                                  className="yt-thumb-img"
                                  src={`https://img.youtube.com/vi/${vidId}/mqdefault.jpg`}
                                  alt={yt.title}
                                  loading="lazy"
                                />
                                <span className="yt-thumb-duration">{yt.durationMinutes} min</span>
                                <span className="yt-thumb-play">▶</span>
                              </div>
                            ) : null;
                          })()}
                          <div className="doc-card-header">
                            <span className={`tier-badge tier-${yt.tier || "intermediate"}`}>
                              {yt.tier || "intermediate"}
                            </span>
                            <span className="external-badge">Official • YouTube</span>
                          </div>
                          <h4 className="doc-card-title">{yt.title}</h4>
                          <div className="doc-card-footer">
                            <span className="doc-source-badge">📺 {yt.channelName}</span>
                            <span className="doc-read-time">{yt.durationMinutes} min</span>
                          </div>
                        </a>
                        <button
                          className={`doc-add-btn ${inCart ? "doc-added" : ""}`}
                          onClick={() => {
                            if (inCart) {
                              removeFromCart(ytId);
                            } else {
                              addToCart({
                                type: "youtube",
                                itemId: ytId,
                                title: yt.title,
                                description: yt.description || "",
                                keyTakeaways: yt.keyTakeaways || [],
                                chapters: yt.chapters || [],
                                topics: yt.topics || [],
                                url: yt.url,
                                channelName: yt.channelName,
                                channelTrust: yt.channelTrust,
                                tier: yt.tier || "intermediate",
                                durationMinutes: yt.durationMinutes || 15,
                              });
                            }
                          }}
                          title={inCart ? "Remove from path" : "Add to learning path"}
                        >
                          {inCart ? "✓ Added" : "➕ Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

      {stage === STAGES.GUIDED &&
        (() => {
          // Track micro-lesson steps for the first doc item
          const microLessonSteps = diagnosisData?.microLesson?.quick_fix?.steps;
          return (
            <GuidedPlayer
              courses={(() => {
                // Group same-course cart items so videos play in original order
                const courseGroups = new Map(); // courseCode → { course, videos[] }
                const orderedKeys = []; // preserve first-seen order

                for (const item of cart) {
                  const itemType = item.type || "video";

                  // Doc or YouTube → reading step pseudo-course (standalone)
                  if (itemType === "doc" || itemType === "youtube") {
                    const isFirstDoc =
                      orderedKeys.filter((k) => k.startsWith("_doc_")).length === 0;
                    const key = `_doc_${item.itemId || item.url || item.driveId}`;
                    orderedKeys.push(key);
                    courseGroups.set(key, {
                      course: {
                        code: item.itemId || item.driveId || `${itemType}_${item.url}`,
                        title: item.title,
                        _readingStep: true,
                        _resourceType: itemType,
                        _description: item.description || "",
                        _keySteps:
                          isFirstDoc && microLessonSteps?.length > 0
                            ? microLessonSteps
                            : item.keyTakeaways || item.keySteps || [],
                        _seeAlso: item.seeAlso || [],
                        _url: item.url,
                        _tier: item.tier,
                        _channel: item.channel || item.channelName,
                        _channelTrust: item.channelTrust,
                        _subsystem: item.subsystem,
                        _topics: item.topics || [],
                        _sections: item.sections || [],
                        _chapters: item.chapters || [],
                        _readTimeMinutes: item.readTimeMinutes || item.durationMinutes || 10,
                        videos: [],
                      },
                    });
                    continue;
                  }

                  // Video → group by courseCode
                  const cKey = item.courseCode;
                  if (!courseGroups.has(cKey)) {
                    const fullCourse = courses.find((c) => c.code === cKey);
                    orderedKeys.push(cKey);
                    courseGroups.set(cKey, {
                      course: fullCourse
                        ? { ...fullCourse, videos: [] }
                        : { code: cKey, title: item.courseName, videos: [] },
                      videos: [],
                    });
                  }
                  courseGroups.get(cKey).videos.push({
                    drive_id: item.driveId,
                    title: item.title,
                    duration_seconds: item.duration,
                    _videoIndex: item.videoIndex ?? 999,
                  });
                }

                // Sort videos within each course by original index, then attach
                const result = orderedKeys.map((key) => {
                  const group = courseGroups.get(key);
                  if (group.videos?.length > 0) {
                    group.videos.sort((a, b) => a._videoIndex - b._videoIndex);
                    group.course.videos = group.videos;
                  }
                  return group.course;
                });

                // Pin intro courses (100.01, 100.02) first — foundational content
                const INTRO_CODES = new Set(["100.01", "100.02"]);
                const intro = result.filter((c) => INTRO_CODES.has(c.code));
                const rest = result.filter((c) => !INTRO_CODES.has(c.code));
                return [...intro, ...rest];
              })()}
              diagnosis={diagnosisData?.diagnosis}
              problemSummary={diagnosisData?.diagnosis?.problem_summary}
              pathSummary={diagnosisData?.pathSummary}
              microLesson={diagnosisData?.microLesson}
              onComplete={() => {
                // Path complete — stay on the guided player, don't auto-redirect
              }}
              onExit={() => setStage(STAGES.DIAGNOSIS)}
            />
          );
        })()}
    </div>
  );
}
