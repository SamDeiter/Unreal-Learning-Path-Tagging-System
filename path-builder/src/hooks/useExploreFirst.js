/**
 * useExploreFirst — Controller hook for the "Explore & Learn" page.
 *
 * Uses shared services (searchPipeline, blendedPathBuilder, courseToVideos)
 * for the core RAG pipeline. Keeps persona detection and simple stage flow.
 *
 * Flow: INPUT → LOADING → RESULTS → GUIDED
 */
import { useState, useCallback, useMemo } from "react";
import { getFirebaseApp } from "../services/firebaseConfig";
import {
  trackQuerySubmitted,
  trackDiagnosisGenerated,
  trackLearningPathGenerated,
} from "../services/analyticsService";
import { useTagData } from "../context/TagDataContext";
import { useVideoCart } from "./useVideoCart";
import { devLog, devWarn } from "../utils/logger";
import { personaScoringRules } from "../services/PersonaService";
import { getPersonaById } from "../services/PersonaService";
import personaData from "../data/personas.json";

// Shared services (Phase 2 refactor)
import { runSearchPipeline } from "../services/searchPipeline";
import { buildBlendedPathFromDiagnosis } from "../services/blendedPathBuilder";
import { matchAndFlattenToVideos } from "../services/courseToVideos";
import { EXPLORE_STOPWORDS as STOP_WORDS } from "../domain/constants";

// ──────────── Constants ────────────
export const STAGES = {
  INPUT: "input",
  LOADING: "loading",
  RESULTS: "results",
  GUIDED: "guided",
  ERROR: "error",
};

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
    const persona = getPersonaById(bestId);
    if (persona) {
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

        // ── Step 1: Shared search pipeline ──
        const { semanticResults, retrievedPassages } = await runSearchPipeline(
          inputData.query,
          { maxPassages: 8 }
        );

        // ── Step 2: Call queryLearningPath Cloud Function (explore mode) ──
        let cartData;
        let geminiSucceeded = true;
        try {
          const { getFunctions, httpsCallable } = await import("firebase/functions");
          const app = getFirebaseApp();
          const functions = getFunctions(app, "us-central1");
          const queryLearningPath = httpsCallable(functions, "queryLearningPath");

          const result = await queryLearningPath({
            query: inputData.query,
            mode: "explore",
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

        // ── Step 3: Shared course → video pipeline ──
        const { matchedCourses, driveVideos, nonVideoItems, allItems } =
          await matchAndFlattenToVideos(cartData, courses, inputData, semanticResults, {
            preferTroubleshooting: false,
            errorLog: "",
          });

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

        // ── Step 4: Shared blended path builder ──
        const blended = await buildBlendedPathFromDiagnosis(
          inputData, cartData, driveVideos, nonVideoItems, STOP_WORDS
        );
        if (blended) setBlendedPath(blended);

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
    [courses, clearCart]
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
