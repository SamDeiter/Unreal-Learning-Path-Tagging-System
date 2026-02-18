/**
 * useProblemFirst — Controller hook for the Problem-First page.
 *
 * Extracts all state management, the `handleSubmit` orchestration pipeline,
 * and UI callback handlers from ProblemFirst.jsx so the view can stay lean.
 *
 * @returns {Object} All state + handlers the view needs
 */
import { useState, useCallback, useMemo } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "../services/firebaseConfig";
import { matchCoursesToCart } from "../domain/courseMatching";
import { flattenCoursesToVideos } from "../domain/videoRanking";
import { findSimilarCourses } from "../services/semanticSearchService";
import { searchSegmentsHybrid } from "../services/segmentSearchService";
import { searchDocsSemantic } from "../services/docsSearchService";
import { buildLearningPath } from "../services/PathBuilder";
import { buildBlendedPath } from "../services/coverageAnalyzer";
import {
  trackQuerySubmitted,
  trackDiagnosisGenerated,
  trackLearningPathGenerated,
} from "../services/analyticsService";
import { getBoostMap } from "../services/feedbackService";
import { useTagData } from "../context/TagDataContext";
import { useVideoCart } from "./useVideoCart";
import { devLog, devWarn } from "../utils/logger";

// ──────────── Constants ────────────
export const STAGES = {
  INPUT: "input",
  LOADING: "loading",
  CLARIFYING: "clarifying",
  ANSWERED: "answered",
  DIAGNOSIS: "diagnosis",
  GUIDED: "guided",
  ERROR: "error",
};

const STOP_WORDS = new Set([
  "the","and","for","are","but","not","you","all","can","has","her","was",
  "one","our","out","its","how","why","with","from","they","been","have",
  "this","that","what","when","your","into",
]);

// ──────────── Hook ────────────
export default function useProblemFirst() {
  // ── State ──
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
  const [conversationHistory, setConversationHistory] = useState([]);

  // ── Derived ──
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

  // ──────────── Build blended path (docs + YouTube gap-fillers) ────────────
  const _buildBlendedPathForDiagnosis = useCallback(
    async (inputData, cartData, driveVideos, nonVideoItems) => {
      try {
        const rawTags = [
          ...(cartData.diagnosis?.matched_tag_ids || []),
          ...(inputData.detectedTagIds || []),
        ];
        const tagSegments = rawTags.flatMap((t) =>
          t.split(/[._]/).filter((s) => s.length > 2 && s !== "unreal" && s !== "engine")
        );

        const queryWords = (inputData.query || "")
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
        const docTopics = [...new Set(queryWords)];

        // Topic augmentation
        const hasWord = (w) => docTopics.some((t) => t.includes(w));
        if (hasWord("mesh") && !hasWord("skeletal")) {
          docTopics.push("static mesh", "static meshes", "import", "importing");
        }
        if (hasWord("size") || hasWord("scale") || hasWord("wrong")) {
          docTopics.push("scale", "transform");
        }

        const uniqueTopics = [...new Set([...tagSegments, ...docTopics])].slice(0, 15);
        devLog(`[DocTopics] ${docTopics.join(", ")}`);
        devLog(`[AllTopics] ${uniqueTopics.join(", ")}`);

        if (docTopics.length > 0) {
          const blended = await buildBlendedPath(docTopics, driveVideos, {
            maxDocs: 5,
            maxYoutube: 3,
          });
          // Merge non-video items
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
            if (nv.type === "youtube" && !blended.youtube.some((y) => y.url === nv._externalUrl)) {
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
    },
    []
  );

  // ──────────── Main submit handler ────────────
  const handleSubmit = useCallback(
    async (inputData, overrideCaseReport) => {
      clearCart();
      setStage(STAGES.LOADING);
      setError(null);
      setAnswerData(null);
      setClarifyData(null);
      setLastInputData(inputData);

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

                const matchedCourses = await matchCoursesToCart(
                  cartData,
                  courses,
                  inputData.selectedTagIds || [],
                  inputData.errorLog || "",
                  [],
                  null
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
                devLog(
                  `[Cache Expired] Cart is ${Math.round(ageMs / 3600000)}h old — refreshing`
                );
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

        // Step 1: Get query embedding + expanded queries (parallel)
        let queryEmbedding = null;
        let semanticResults = [];
        let retrievedPassages = [];
        let expandedQueries = [];
        try {
          const embedQueryFn = httpsCallable(functions, "embedQuery");
          const expandQueryFn = httpsCallable(functions, "expandQuery");

          const [embedResult, expandResult] = await Promise.allSettled([
            embedQueryFn({ query: inputData.query }),
            expandQueryFn({ query: inputData.query }),
          ]);

          if (expandResult.status === "fulfilled" && expandResult.value.data?.expansions) {
            expandedQueries = expandResult.value.data.expansions;
            devLog(
              `[QueryExpansion] ${expandedQueries.length} variants: ${expandedQueries.join(" | ")}`
            );
          }

          if (
            embedResult.status === "fulfilled" &&
            embedResult.value.data?.success &&
            embedResult.value.data?.embedding
          ) {
            queryEmbedding = embedResult.value.data.embedding;

            const [courseResult, segResult, docResult] = await Promise.allSettled([
              findSimilarCourses(queryEmbedding, 8, 0.35),
              searchSegmentsHybrid(inputData.query, queryEmbedding, [], 8),
              searchDocsSemantic(queryEmbedding, 6, 0.35),
            ]);

            if (courseResult.status === "fulfilled") {
              semanticResults = courseResult.value;
            } else {
              devWarn("⚠️ Course semantic search failed:", courseResult.reason?.message);
            }

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

            // Query Expansion: search expanded variants
            if (expandedQueries.length > 0) {
              const expansionSearches = expandedQueries.map((eq) =>
                searchSegmentsHybrid(eq, null, [], 4).catch(() => [])
              );
              const expansionResults = await Promise.allSettled(expansionSearches);
              let expansionCount = 0;
              for (const er of expansionResults) {
                if (er.status === "fulfilled" && er.value.length > 0) {
                  const expPassages = er.value.map((s) => ({
                    text: s.previewText,
                    courseCode: s.courseCode,
                    videoTitle: s.videoTitle,
                    timestamp: s.timestamp,
                    similarity: (s.similarity || 0) * 0.9,
                    source: "transcript",
                  }));
                  retrievedPassages.push(...expPassages);
                  expansionCount += expPassages.length;
                }
              }
              if (expansionCount > 0) {
                devLog(`[QueryExpansion] +${expansionCount} passages from expanded queries`);
              }
            }

            // Rank + dedup
            retrievedPassages.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
            const seen = new Set();
            retrievedPassages = retrievedPassages.filter((p) => {
              const key = (p.text || "").trim().toLowerCase().slice(0, 120);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            devLog(
              `[RAG] Total: ${retrievedPassages.length} passages after rank+dedup (with expansions)`
            );
          }
        } catch (semanticErr) {
          devWarn("⚠️ Semantic search skipped:", semanticErr.message);
        }

        // Step 1.5: Cross-encoder re-ranking
        if (retrievedPassages.length > 2) {
          try {
            const rerankFn = httpsCallable(functions, "rerankPassages");
            const rerankResult = await rerankFn({
              query: inputData.query,
              passages: retrievedPassages.slice(0, 20),
            });
            if (rerankResult.data?.success && rerankResult.data?.reranked) {
              retrievedPassages = rerankResult.data.reranked;
              if (!rerankResult.data.fallback) {
                devLog(`[Rerank] Passages re-ranked by Gemini cross-encoder`);
              }
            }
          } catch (rerankErr) {
            devWarn("⚠️ Re-ranking skipped:", rerankErr.message);
          }
        }
        retrievedPassages = retrievedPassages.slice(0, 8);

        // Step 2: Call queryLearningPath Cloud Function
        let cartData;
        let geminiSucceeded = true;
        try {
          const queryLearningPath = httpsCallable(functions, "queryLearningPath");
          let result = await queryLearningPath({
            query: inputData.query,
            mode: "problem-first",
            detectedTagIds: inputData.detectedTagIds,
            personaHint: inputData.personaHint,
            retrievedContext: retrievedPassages.slice(0, 8),
            caseReport: activeCaseReport || undefined,
            conversationHistory: inputData._conversationHistory || conversationHistory,
          });

          if (!result.data.success && result.data.error === "off_topic") {
            setError(
              result.data.message ||
                "This doesn't appear to be a UE5 question. Please describe a specific Unreal Engine 5 issue."
            );
            setStage(STAGES.ERROR);
            return;
          }

          if (result.data.responseType === "NEEDS_CLARIFICATION") {
            // Store the assistant's question in conversation history
            setConversationHistory((prev) => [
              ...prev,
              { role: "assistant", content: result.data.question },
            ]);
            setClarifyData({
              question: result.data.question,
              options: result.data.options || [],
              whyAsking: result.data.whyAsking || "",
              query: result.data.query,
              caseReport: result.data.caseReport,
              clarifyRound: result.data.clarifyRound || 1,
              maxClarifyRounds: result.data.maxClarifyRounds || 3,
              conversationHistory: result.data.conversationHistory || [],
            });
            setStage(STAGES.CLARIFYING);
            return;
          }

          // ── Agentic RAG: AI requested more context ──
          if (result.data.responseType === "NEEDS_MORE_CONTEXT") {
            devLog(
              `[AgenticRAG] Cloud function requested ${result.data.searchQueries?.length} targeted searches: ${result.data.searchQueries?.join(" | ")}`
            );
            try {
              // Run AI-suggested searches in parallel
              const agenticSearches = (result.data.searchQueries || []).flatMap((sq) => [
                searchSegmentsHybrid(sq, null, [], 4).catch(() => []),
                searchDocsSemantic(null, 3, 0.3, sq).catch(() => []),
              ]);
              const agenticResults = await Promise.allSettled(agenticSearches);

              // Collect new passages from agentic searches
              const newPassages = [];
              for (const ar of agenticResults) {
                if (ar.status !== "fulfilled" || !Array.isArray(ar.value)) continue;
                for (const item of ar.value) {
                  if (item.previewText || item.text) {
                    newPassages.push({
                      text: item.previewText || item.text || "",
                      courseCode: item.courseCode || "",
                      videoTitle: item.videoTitle || item.title || "",
                      timestamp: item.timestamp || "",
                      similarity: (item.similarity || 0) * 0.85, // slight discount for agentic
                      source: item.url ? "epic_docs" : "transcript",
                      url: item.url || "",
                      title: item.title || "",
                      section: item.section || "",
                    });
                  }
                }
              }

              devLog(`[AgenticRAG] Found ${newPassages.length} additional passages`);

              // Merge with existing passages, dedup, re-rank
              const merged = [...retrievedPassages, ...newPassages];
              const seen = new Set();
              const deduped = merged.filter((p) => {
                const key = (p.text || "").trim().toLowerCase().slice(0, 120);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
              deduped.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
              const enrichedPassages = deduped.slice(0, 12);

              // Re-submit with enriched passages and agenticRound counter
              devLog(`[AgenticRAG] Re-submitting with ${enrichedPassages.length} enriched passages`);
              const retryResult = await queryLearningPath({
                query: inputData.query,
                mode: "problem-first",
                detectedTagIds: inputData.detectedTagIds,
                personaHint: inputData.personaHint,
                retrievedContext: enrichedPassages,
                caseReport: activeCaseReport || undefined,
                conversationHistory: inputData._conversationHistory || conversationHistory,
                agenticRound: result.data.agenticRound || 1, // prevent infinite loop
              });

              // Process the retry result (should be ANSWER or fallback)
              if (retryResult.data?.responseType === "ANSWER") {
                result = retryResult; // Replace result so the code below handles it
                // Update retrievedPassages for blended path building
                retrievedPassages = enrichedPassages;
              } else {
                devWarn("[AgenticRAG] Retry didn't produce ANSWER, using original result");
              }
            } catch (agenticErr) {
              devWarn("[AgenticRAG] Escalation failed, proceeding with best-effort:", agenticErr.message);
            }
          }

          if (!result.data.success)
            throw new Error(result.data.message || "Failed to process query");

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
        cartData.retrievedPassages = retrievedPassages;
        cartData._localFallback = !geminiSucceeded;

        // Fetch user's feedback boost map
        const currentUser = getAuth(getFirebaseApp()).currentUser;
        const boostMap = currentUser ? await getBoostMap(currentUser.uid) : null;

        // Match courses
        const matchedCourses = await matchCoursesToCart(
          cartData,
          courses,
          inputData.selectedTagIds || [],
          inputData.errorLog || "",
          semanticResults,
          boostMap
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

        // Flatten to videos
        const allItems = await flattenCoursesToVideos(matchedCourses, inputData.query, roleMap);
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
        await _buildBlendedPathForDiagnosis(inputData, cartData, driveVideos, nonVideoItems);

        // If we have answer-first data, show ANSWERED stage first
        setStage(answerData ? STAGES.ANSWERED : STAGES.DIAGNOSIS);

        // Update history with cart_id
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
    [courses, getDetectedPersona, clearCart, caseReport, answerData, _buildBlendedPathForDiagnosis, conversationHistory]
  );

  // ──────────── UI Handlers ────────────
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
    setConversationHistory([]);
  }, []);

  const handleClarifyAnswer = useCallback(
    (answer) => {
      if (!lastInputData) return;
      // Push user's answer into conversation history
      const updatedHistory = [
        ...conversationHistory,
        { role: "user", content: answer },
      ];
      setConversationHistory(updatedHistory);

      // Re-submit with full conversation history (not string-append)
      const augmentedInput = {
        ...lastInputData,
        _conversationHistory: updatedHistory,
      };
      handleSubmit(augmentedInput, caseReport);
    },
    [lastInputData, caseReport, handleSubmit, conversationHistory]
  );

  const handleClarifySkip = useCallback(() => {
    if (!lastInputData) return;
    // Skip clarification — force best-effort by sending max-round history
    const skipHistory = [
      ...conversationHistory,
      { role: "user", content: "(skipped — proceed with best effort)" },
    ];
    setConversationHistory(skipHistory);
    const augmentedInput = {
      ...lastInputData,
      _conversationHistory: skipHistory,
    };
    handleSubmit(augmentedInput, caseReport);
  }, [lastInputData, caseReport, handleSubmit, conversationHistory]);

  const handleFeedback = useCallback(
    (feedback) => {
      if (feedback.solved) {
        devLog("[Feedback] User confirmed solution worked");
        return;
      }
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

  // ── Return ──
  return {
    // State
    stage,
    diagnosisData,
    error,
    blendedPath,
    videoResults,
    answerData,
    clarifyData,
    isRerunning,
    courses,

    // Cart
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,

    // Handlers
    handleSubmit,
    handleReset,
    handleAskAgain,
    handleClarifyAnswer,
    handleClarifySkip,
    handleFeedback,
    handleBackToVideos,
    handleVideoToggle,
    handleWatchPath,

    // Setters (for CaseReportForm)
    setCaseReport,

    // Helpers
    getDetectedPersona,
  };
}
