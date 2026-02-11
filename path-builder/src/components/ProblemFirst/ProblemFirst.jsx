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
import { searchSegmentsSemantic } from "../../services/segmentSearchService";
import { searchDocsSemantic } from "../../services/docsSearchService";
import { buildLearningPath } from "../../services/PathBuilder";
import { buildBlendedPath } from "../../services/coverageAnalyzer";
import { isEnabled as isExternalEnabled } from "../../services/externalContentService";
import {
  trackQuerySubmitted,
  trackDiagnosisGenerated,
  trackLearningPathGenerated,
} from "../../services/analyticsService";
import { useTagData } from "../../context/TagDataContext";
import "./ProblemFirst.css";

import { devLog, devWarn } from "../../utils/logger";



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
  const [blendedPath, setBlendedPath] = useState(null);
  const [videoResults, setVideoResults] = useState([]);


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
      clearCart();
      setStage(STAGES.LOADING);
      setError(null);

      if (inputData.pastedImage) {
        devLog(
          "[ProblemFirst] Screenshot attached (base64 length):",
          inputData.pastedImage.length
        );
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
              const cachedAt = cachedCart.cached_at?.toDate?.() || new Date(cachedCart.created_at || 0);
              const ageMs = Date.now() - cachedAt.getTime();
              const TTL_MS = 24 * 60 * 60 * 1000;

              if (ageMs < TTL_MS) {
                devLog(`[Cache Hit] Cart is ${Math.round(ageMs / 60000)}min old — using cached result`);

                const cartData = { ...cachedCart, userQuery: inputData.query, retrievedPassages: [] };

                // Re-run local matching (no Gemini calls)
                const matchedCourses = await matchCoursesToCart(
                  cartData, courses, inputData.selectedTagIds || [], inputData.errorLog || "", []
                );
                cartData.matchedCourses = matchedCourses;

                const matchedTagIds = [
                  ...(cartData.diagnosis?.matched_tag_ids || []),
                  ...(inputData.detectedTagIds || []),
                  ...(inputData.selectedTagIds || []),
                ];
                const pathResult = buildLearningPath(matchedCourses, matchedTagIds, {
                  preferTroubleshooting: true, diversity: true,
                });

                const roleMap = {};
                for (const item of pathResult.path) {
                  roleMap[item.course.code] = {
                    role: item.role, reason: item.reason, estimatedMinutes: item.estimatedMinutes,
                  };
                }

                const videos = await flattenCoursesToVideos(matchedCourses, inputData.query, roleMap);

                if (videos.length > 0) {
                  setVideoResults(videos);
                  setDiagnosisData(cartData);
                  setStage(STAGES.DIAGNOSIS);
                  devLog(`[Cache] Loaded ${videos.length} videos from cached cart — 0 Gemini calls`);
                  return;
                }
                devWarn("[Cache] Cached cart produced 0 videos — falling through to fresh diagnosis");
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
            // Course-level semantic search (existing)
            semanticResults = await findSimilarCourses(queryEmbedding, 8, 0.35);
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
                const docResults = await searchDocsSemantic(queryEmbedding, 6, 0.35);
                docPassages = docResults.map((d) => ({
                  text: d.previewText,
                  url: d.url,
                  title: d.title,
                  section: d.section,
                  similarity: d.similarity,
                  source: "epic_docs",
                }));
              } catch (docErr) {
                devWarn("⚠️ Docs semantic search skipped:", docErr.message);
              }

              retrievedPassages = [...segPassages, ...docPassages];
              devLog(
                `[RAG] Retrieved ${segPassages.length} transcript + ${docPassages.length} doc passages`
              );
            } catch (segErr) {
              devWarn("⚠️ Segment semantic search skipped:", segErr.message);
            }
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
            retrievedContext: retrievedPassages.slice(0, 5), // Top 5 passages
          });

          if (!result.data.success) throw new Error(result.data.message || "Failed to process query");

          cartData = result.data.cart;
        } catch (geminiErr) {
          // Graceful fallback on 429 or other Gemini errors — use local-only matching
          const is429 = geminiErr.message?.includes("429") || geminiErr.code === "resource-exhausted";
          devWarn(`⚠️ Gemini ${is429 ? "rate limited (429)" : "error"}: ${geminiErr.message}. Falling back to local matching.`);
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
        const videos = await flattenCoursesToVideos(matchedCourses, inputData.query, roleMap);

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

        // Build blended path (docs + YouTube gap-fillers)
        try {
          const rawTags = [
            ...(cartData.diagnosis?.matched_tag_ids || []),
            ...(inputData.detectedTagIds || []),
          ];
          // Split dotted tag IDs into individual segments: "unreal_engine.blueprint.casting" → ["blueprint", "casting"]
          const tagSegments = rawTags.flatMap((t) =>
            t.split(/[._]/).filter((s) => s.length > 2 && s !== "unreal" && s !== "engine")
          );
          // Also extract keywords from the user's query
          const queryWords = (inputData.query || "").toLowerCase().split(/\s+/)
            .filter((w) => w.length > 3);
          const uniqueTopics = [...new Set([...tagSegments, ...queryWords])].slice(0, 12);
          if (uniqueTopics.length > 0) {
            const blended = await buildBlendedPath(uniqueTopics, videos, { maxDocs: 5, maxYoutube: 3 });
            setBlendedPath(blended);
            devLog(`[Blended] ${blended.docs.length} docs, ${blended.youtube.length} YT, coverage: ${(blended.coverageScore * 100).toFixed(0)}%`);
          }
        } catch (blendedErr) {
          devWarn("⚠️ Blended path skipped:", blendedErr.message);
        }

        setStage(STAGES.DIAGNOSIS);

        // Update history with cart_id so future clicks use cache
        if (inputData.updateCartIdForQuery && cartData.cart_id) {
          inputData.updateCartIdForQuery(inputData.query, cartData.cart_id);
          devLog(`[Cache] Saved cart_id ${cartData.cart_id} to history for: "${inputData.query.substring(0, 40)}..."`);
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
    [courses, getDetectedPersona, clearCart]
  );

  const handleAskAgain = useCallback(() => setStage(STAGES.INPUT), []);

  const handleReset = useCallback(() => {
    setStage(STAGES.INPUT);
    setDiagnosisData(null);
    setVideoResults([]);

    setError(null);
    setBlendedPath(null);
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
            <div className="tldr-diagnosis">
              <div className="tldr-user-query">
                <span className="tldr-query-label">🔍 You asked:</span>
                <p className="tldr-query-text">{diagnosisData.userQuery}</p>
              </div>
              {diagnosisData._localFallback && (
                <div className="tldr-fallback-notice" style={{
                  background: 'rgba(255, 193, 7, 0.1)',
                  border: '1px solid rgba(255, 193, 7, 0.3)',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  margin: '8px 0',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted, #aaa)',
                }}>
                  ⚡ <strong>Fast results</strong> — AI diagnosis unavailable (rate limit). Videos matched by tag taxonomy.
                </div>
              )}
              {diagnosisData.diagnosis?.problem_summary && (
                <p className="tldr-bridge">Based on your question, we think these videos will help you:</p>
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
                { key: "prerequisite", icon: "🔗", label: "Prerequisite", desc: "Build the foundation first — these cover concepts you'll need before tackling the main topic." },
                { key: "core",         icon: "⭐", label: "Core",         desc: "These directly address your question and are the most important videos to watch." },
                { key: "troubleshooting", icon: "🔧", label: "Troubleshooting", desc: "Debugging helpers — watch these if you're hitting errors or unexpected behavior." },
                { key: "supplemental", icon: "📚", label: "Supplemental", desc: "Go deeper — extra context and advanced techniques for when you're ready." },
              ];

              const grouped = {};
              for (const section of ROLE_SECTIONS) grouped[section.key] = [];
              grouped._other = [];

              for (const video of videoResults) {
                const role = video.role || "_other";
                (grouped[role] || grouped._other).push(video);
              }

              return ROLE_SECTIONS
                .filter((s) => grouped[s.key].length > 0)
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
                        <div key={video.driveId} className="video-result-wrapper" id={`video-${video.driveId}`}>
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
                            <h3 className="role-section-title">📎 Related <span className="role-section-count">{grouped._other.length}</span></h3>
                            <p className="role-section-desc">Additional videos that may be relevant to your query.</p>
                          </div>
                          <div className="video-results-grid">
                            {grouped._other.map((video) => (
                              <div key={video.driveId} className="video-result-wrapper" id={`video-${video.driveId}`}>
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
                      <div key={doc.key || i} className={`doc-card ${inCart ? "doc-card-added" : ""}`}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="doc-card-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="doc-card-header">
                            {doc.matchScore != null && (() => {
                              const tier = doc.matchScore >= 90 ? "best" : doc.matchScore >= 60 ? "strong" : doc.matchScore >= 30 ? "good" : "related";
                              const label = doc.matchScore >= 90 ? "Best Match" : doc.matchScore >= 60 ? "Strong" : doc.matchScore >= 30 ? "Good" : "Related";
                              return (
                                <span className={`doc-match-badge doc-match-${tier}`} title={`${doc.matchScore}% relevancy`}>
                                  <span className="doc-match-dot" />{label}
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
                          {doc.description && (
                            <p className="doc-card-desc">{doc.description}</p>
                          )}
                          <div className="doc-card-footer">
                            <span className="doc-source-badge">📄 Epic Docs</span>
                            <span className="doc-read-time">{doc.readTimeMinutes || 10} min read</span>
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

            {/* 📺 Community Resources — YouTube (third-party, if enabled) */}
            {isExternalEnabled() && blendedPath?.youtube?.length > 0 && (
              <div className="blended-section external-section">
                <div className="blended-section-header">
                  <h2 className="blended-section-title">📺 Community Resources</h2>
                  <p className="blended-section-desc">
                    Curated videos from trusted UE5 creators to fill any remaining gaps.
                  </p>
                </div>
                <div className="doc-cards-grid">
                  {blendedPath.youtube.map((yt) => {
                    const ytId = yt.id || `yt_${yt.url}`;
                    const inCart = isInCart(ytId);
                    return (
                      <div key={yt.id} className={`doc-card external-card ${inCart ? "doc-card-added" : ""}`}>
                        <a
                          href={yt.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="doc-card-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="doc-card-header">
                            <span className={`tier-badge tier-${yt.tier || "intermediate"}`}>
                              {yt.tier || "intermediate"}
                            </span>
                            <span className="external-badge">External • YouTube</span>
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
                                url: yt.url,
                                channel: yt.channelName,
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

      {stage === STAGES.GUIDED && (
        <GuidedPlayer
          courses={cart.map((item) => {
            const itemType = item.type || "video";

            // Doc or YouTube → reading step pseudo-course
            if (itemType === "doc" || itemType === "youtube") {
              return {
                code: item.itemId || `${itemType}_${item.url}`,
                title: item.title,
                _readingStep: true,
                _resourceType: itemType,
                _description: item.description || "",
                _keySteps: item.keySteps || [],
                _seeAlso: item.seeAlso || [],
                _url: item.url,
                _tier: item.tier,
                _channel: item.channel,
                _subsystem: item.subsystem,
                _readTimeMinutes: item.readTimeMinutes || item.durationMinutes || 10,
                videos: [],
              };
            }

            // Video → normal course mapping (existing logic)
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
            // Path complete — stay on the guided player, don't auto-redirect
          }}
          onExit={() => setStage(STAGES.DIAGNOSIS)}
        />
      )}
    </div>
  );
}
