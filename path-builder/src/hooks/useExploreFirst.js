/**
 * useExploreFirst — Controller hook for the new Onboarding "Explore & Learn" page.
 *
 * Forked from useProblemFirst.js — keeps the full semantic search + video
 * shopping cart pipeline but removes Fix-specific stages (CLARIFYING, ANSWERED).
 *
 * Flow: INPUT → LOADING → RESULTS → GUIDED
 *
 * Also adds silent persona detection from query keywords.
 */
import { useState, useCallback, useMemo } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
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
import { personaScoringRules } from "../services/PersonaService";
import { getPersonaById } from "../services/PersonaService";
import personaData from "../data/personas.json";

// ──────────── Constants ────────────
export const STAGES = {
  INPUT: "input",
  LOADING: "loading",
  RESULTS: "results",   // was "diagnosis" — renamed for clarity
  GUIDED: "guided",
  ERROR: "error",
};

const STOP_WORDS = new Set([
  "the","and","for","are","but","not","you","all","can","has","her","was",
  "one","our","out","its","how","why","with","from","they","been","have",
  "this","that","what","when","your","into","want","learn","using","make",
  "need","like","about","would","could","should","really","unreal","engine",
]);

// ──────────── Silent Persona Detection ────────────
function detectPersonaFromQuery(query) {
  if (!query) return null;
  const q = query.toLowerCase();

  // Score each persona by how many boost keywords match
  let bestId = null;
  let bestScore = 0;

  for (const [personaId, rules] of Object.entries(personaScoringRules)) {
    let score = 0;
    for (const kw of rules.boostKeywords || []) {
      if (q.includes(kw.toLowerCase())) score += 1;
    }
    // Penalize if penalty keywords match
    for (const kw of rules.penaltyKeywords || []) {
      if (q.includes(kw.toLowerCase())) score -= 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = personaId;
    }
  }

  // Only detect if at least 1 keyword matched
  if (bestScore >= 1 && bestId) {
    // Also try the full persona data
    const persona = getPersonaById(bestId);
    if (persona) {
      // Persist to localStorage so other components can use it
      try {
        localStorage.setItem("detected_persona", JSON.stringify(persona));
      } catch { /* ignore */ }
      return persona;
    }
  }

  // Fallback: check persona keywords from personas.json directly
  const allPersonas = personaData?.personas || [];
  for (const persona of allPersonas) {
    if (!persona.onboardingPrimary) continue;
    const kwMatches = (persona.keywords || []).filter(kw =>
      q.includes(kw.toLowerCase())
    ).length;
    if (kwMatches >= 2) {
      try {
        localStorage.setItem("detected_persona", JSON.stringify(persona));
      } catch { /* ignore */ }
      return persona;
    }
  }

  return null;
}

// ──────────── Hook ────────────
export default function useExploreFirst() {
  // ── State ──
  const [stage, setStage] = useState(STAGES.INPUT);
  const [diagnosisData, setDiagnosisData] = useState(null);
  const [error, setError] = useState(null);
  const [blendedPath, setBlendedPath] = useState(null);
  const [videoResults, setVideoResults] = useState([]);
  const [detectedPersona, setDetectedPersona] = useState(null);

  // ── Derived ──
  const { cart, addToCart, removeFromCart, clearCart, isInCart } = useVideoCart();
  const tagData = useTagData();
  const courses = useMemo(() => tagData?.courses || [], [tagData?.courses]);

  // ──────────── Build blended path (docs + YouTube gap-fillers) ────────────
  const _buildBlendedPath = useCallback(
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
        if (hasWord("size") || hasWord("scale")) {
          docTopics.push("scale", "transform");
        }

        const uniqueTopics = [...new Set([...tagSegments, ...docTopics])].slice(0, 15);

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
    async (inputData) => {
      clearCart();
      setStage(STAGES.LOADING);
      setError(null);

      // Silent persona detection from query text
      const persona = detectPersonaFromQuery(inputData.query);
      if (persona) {
        setDetectedPersona(persona);
        devLog(`[Persona] Silently detected: ${persona.name} (${persona.id})`);
      }

      try {
        await trackQuerySubmitted(
          inputData.query,
          inputData.detectedTagIds,
          persona?.id
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
            devLog(`[QueryExpansion] ${expandedQueries.length} variants`);
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
            }

            // Query Expansion: search expanded variants
            if (expandedQueries.length > 0) {
              const expansionSearches = expandedQueries.map((eq) =>
                searchSegmentsHybrid(eq, null, [], 4).catch(() => [])
              );
              const expansionResults = await Promise.allSettled(expansionSearches);
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
                }
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
            devLog(`[RAG] Total: ${retrievedPassages.length} passages after rank+dedup`);
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
            }
          } catch (rerankErr) {
            devWarn("⚠️ Re-ranking skipped:", rerankErr.message);
          }
        }
        retrievedPassages = retrievedPassages.slice(0, 8);

        // Step 2: Call queryLearningPath Cloud Function (explore mode)
        let cartData;
        let geminiSucceeded = true;
        try {
          const queryLearningPath = httpsCallable(functions, "queryLearningPath");
          const result = await queryLearningPath({
            query: inputData.query,
            mode: "explore",  // Different mode from "problem-first"
            detectedTagIds: inputData.detectedTagIds,
            personaHint: persona?.id || inputData.personaHint,
            retrievedContext: retrievedPassages.slice(0, 8),
          });

          if (!result.data.success && result.data.error === "off_topic") {
            setError(
              result.data.message ||
                "This doesn't appear to be a UE5 topic. Please describe what you want to learn about Unreal Engine 5."
            );
            setStage(STAGES.ERROR);
            return;
          }

          // For explore mode, skip CLARIFYING/ANSWERED — go straight to results
          // If the CF returns NEEDS_CLARIFICATION, treat the cart data as best-effort
          if (!result.data.success)
            throw new Error(result.data.message || "Failed to process query");

          cartData = result.data.cart;
        } catch (geminiErr) {
          const isOffTopic =
            geminiErr.message?.includes("off_topic") || geminiErr.message?.includes("not a UE5");

          if (isOffTopic) {
            setError(
              "This doesn't appear to be a UE5 topic. Try describing what you want to learn, for example:\n" +
                '• "I want to learn Blueprints"\n' +
                '• "How to create materials and shaders"\n' +
                '• "Getting started with Niagara particles"'
            );
            setStage(STAGES.ERROR);
            return;
          }

          devWarn(`⚠️ Gemini error: ${geminiErr.message}. Falling back to local matching.`);
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
          "",  // no error log for explore mode
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
          preferTroubleshooting: false,  // explore mode — prefer introductory content
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
            "We couldn't find content matching your query. " +
              "Try describing what you want to learn, for example:\n" +
              '• "I want to learn Blueprint scripting"\n' +
              '• "How to set up materials and lighting"\n' +
              '• "Getting started with Niagara particles"'
          );
          setStage(STAGES.ERROR);
          return;
        }

        setVideoResults(driveVideos);
        setDiagnosisData(cartData);

        // Build blended path (docs + YouTube gap-fillers)
        await _buildBlendedPath(inputData, cartData, driveVideos, nonVideoItems);

        // Always go to RESULTS stage (no ANSWERED check like the fix-a-problem flow)
        setStage(STAGES.RESULTS);

        await trackDiagnosisGenerated(cartData.diagnosis);
        await trackLearningPathGenerated(
          cartData.objectives,
          matchedCourses,
          cartData.validation?.approved
        );
      } catch (err) {
        console.error("[ExploreFirst] Error:", err);
        setError(err.message || "An unexpected error occurred");
        setStage(STAGES.ERROR);
      }
    },
    [courses, clearCart, _buildBlendedPath]
  );

  // ──────────── UI Handlers ────────────
  const handleReset = useCallback(() => {
    setStage(STAGES.INPUT);
    setDiagnosisData(null);
    setVideoResults([]);
    setError(null);
    setBlendedPath(null);
    setDetectedPersona(null);
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

  const handleBackToResults = useCallback(() => {
    setStage(STAGES.RESULTS);
  }, []);

  // ── Return ──
  return {
    // State
    stage,
    diagnosisData,
    error,
    blendedPath,
    videoResults,
    detectedPersona,
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
    handleVideoToggle,
    handleWatchPath,
    handleBackToResults,
  };
}
