/**
 * useExploreFirst — Controller hook for the "Explore & Learn" page.
 *
 * Uses shared services (useSearchSubmit, useVideoActions) for the core
 * RAG pipeline. Keeps persona detection and simple stage flow.
 *
 * Flow: INPUT → LOADING → RESULTS → GUIDED
 */
import { useState, useCallback } from "react";
import { useVideoCart } from "./useVideoCart";
import { devLog } from "../utils/logger";
import { personaScoringRules } from "../services/PersonaService";
import { getPersonaById } from "../services/PersonaService";
import personaData from "../data/personas.json";

// Shared hooks (deduplication refactor)
import { executeSearchPipeline, useCourses } from "./useSearchSubmit";
import { useVideoActions } from "./useVideoActions";
import { EXPLORE_STOPWORDS as STOP_WORDS } from "../domain/constants";

// ──────────── Constants ────────────
export const STAGES = {
  INPUT: "input",
  LOADING: "loading",
  RESULTS: "results",
  GUIDED: "guided",
  ERROR: "error",
};

const EXPLORE_EXAMPLES = [
  "I want to learn Blueprint scripting",
  "How to set up materials and lighting",
  "Getting started with Niagara particles",
];

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

  // ── Shared hooks ──
  const { cart, addToCart, removeFromCart, clearCart, isInCart } = useVideoCart();
  const courses = useCourses();
  const { handleVideoToggle, handleWatchPath } = useVideoActions({
    isInCart, addToCart, removeFromCart, cart, setStage,
    guidedStage: STAGES.GUIDED,
  });

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
        // ── Shared 4-step pipeline ──
        const result = await executeSearchPipeline({
          inputData,
          courses,
          cloudFnPayload: {
            mode: "explore",
            personaHint: persona?.id || inputData.personaHint,
          },
          pipelineOpts: {
            maxPassages: 8,
            preferTroubleshooting: false,
            errorLog: "",
            stopWords: STOP_WORDS,
            personaId: persona?.id,
            offTopicExamples: EXPLORE_EXAMPLES,
          },
        });

        // Handle pipeline errors
        if (result.error) {
          setError(result.error);
          setStage(STAGES.ERROR);
          return;
        }

        // Success — apply results
        setVideoResults(result.driveVideos);
        setDiagnosisData(result.cartData);
        if (result.blendedPath) setBlendedPath(result.blendedPath);
        setStage(STAGES.RESULTS);
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
