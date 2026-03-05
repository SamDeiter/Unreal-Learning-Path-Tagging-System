/**
 * Analytics Service - Centralized event tracking for learning intelligence
 * Tracks events to answer:
 * - Where do learners get stuck?
 * - Which diagnostics reduce repeat failures?
 * - Which personas override system suggestions?
 * - Does problem-first learning reduce drop-off?
 */

import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";

/**
 * Analytics Event Types
 */
export const EVENTS = {
  // Persona & Onboarding
  PERSONA_DETECTED: "persona_detected",
  ONBOARDING_PATH_GENERATED: "onboarding_path_generated",

  // Problem-First Learning
  QUERY_SUBMITTED: "query_submitted",
  INTENT_EXTRACTED: "intent_extracted",
  DIAGNOSIS_GENERATED: "diagnosis_generated",
  LEARNING_PATH_GENERATED: "learning_path_generated",

  // User Behavior
  MODULE_SKIPPED: "module_skipped",
  MODULE_REORDERED: "module_reordered",
  COURSE_CLICKED: "course_clicked",

  // Session
  SESSION_STARTED: "session_started",
  SESSION_COMPLETED: "session_completed",
  FOLLOWUP_QUERY_SUBMITTED: "followup_query_submitted",

  // Validation
  CURRICULUM_VALIDATED: "curriculum_validated",
  CURRICULUM_REJECTED: "curriculum_rejected",

  // New features
  AUDIO_BRIEFING_GENERATED: "audio_briefing_generated",
  AUDIO_BRIEFING_PLAYED: "audio_briefing_played",
  QUIZ_STARTED: "quiz_started",
  QUIZ_COMPLETED: "quiz_completed",
  PATH_STEP_VIEWED: "path_step_viewed",

  // RAG Pipeline Metrics
  VECTOR_SEARCH_COMPLETED: "vector_search_completed",
  HYBRID_FALLBACK_TRIGGERED: "hybrid_fallback_triggered",
  PATH_SEQUENCED: "path_sequenced",
  BLUEPRINT_LINK_SHOWN: "blueprint_link_shown",
};

/**
 * Session ID generator
 */
let currentSessionId = null;

function getSessionId() {
  if (!currentSessionId) {
    currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  return currentSessionId;
}

/**
 * Track an analytics event
 * @param {string} eventName - One of EVENTS
 * @param {Object} payload - Event-specific data
 * @returns {Promise<void>}
 */
export async function trackEvent(eventName, payload = {}) {
  try {
    const db = getFirestore(getFirebaseApp());

    const eventData = {
      event: eventName,
      session_id: getSessionId(),
      ...payload,
      timestamp: serverTimestamp(),
      client_timestamp: new Date().toISOString(),
    };

    await addDoc(collection(db, "analytics_events"), eventData);

    // Also log to console in development
    if (import.meta.env?.DEV) {
      devLog("[Analytics]", eventName, payload);
    }
  } catch (error) {
    // Don't let analytics failures break the app
    devWarn("[Analytics] Failed to track event:", eventName, error.message);
  }
}

/**
 * Track persona detection
 * @param {Object} persona
 * @param {string} source - 'onboarding' or 'inferred'
 */
export function trackPersonaDetected(persona, source = "onboarding") {
  return trackEvent(EVENTS.PERSONA_DETECTED, {
    persona_id: persona?.id,
    persona_name: persona?.name,
    industry: persona?.industry,
    source,
  });
}

/**
 * Track onboarding path generation
 * @param {Object} persona
 * @param {Object[]} courses
 * @param {number} totalTime
 */
export function trackOnboardingPathGenerated(persona, courses, totalTime) {
  return trackEvent(EVENTS.ONBOARDING_PATH_GENERATED, {
    persona_id: persona?.id,
    course_count: courses?.length || 0,
    total_minutes: totalTime,
    course_ids: courses?.slice(0, 10).map((c) => c.id || c.code),
  });
}

/**
 * Track problem-first query submission
 * @param {string} query
 * @param {string[]} detectedTags
 * @param {string} personaId - If persona is known
 */
export function trackQuerySubmitted(query, detectedTags = [], personaId = null) {
  return trackEvent(EVENTS.QUERY_SUBMITTED, {
    query_length: query?.length || 0,
    query_preview: query?.substring(0, 100),
    detected_tag_count: detectedTags.length,
    detected_tags: detectedTags.slice(0, 5),
    persona_id: personaId,
  });
}

/**
 * Track intent extraction
 * @param {Object} intent
 */
export function trackIntentExtracted(intent) {
  return trackEvent(EVENTS.INTENT_EXTRACTED, {
    intent_id: intent?.intent_id,
    systems_count: intent?.systems?.length || 0,
    systems: intent?.systems?.slice(0, 5),
    constraints_count: intent?.constraints?.length || 0,
  });
}

/**
 * Track diagnosis generation
 * @param {Object} diagnosis
 */
export function trackDiagnosisGenerated(diagnosis) {
  return trackEvent(EVENTS.DIAGNOSIS_GENERATED, {
    diagnosis_id: diagnosis?.diagnosis_id,
    root_causes_count: diagnosis?.root_causes?.length || 0,
    signals_count: diagnosis?.signals_to_watch_for?.length || 0,
    generalization_scope: diagnosis?.generalization_scope?.slice(0, 3),
  });
}

/**
 * Track learning path generation (problem-first)
 * @param {Object} objectives
 * @param {Object[]} courses
 * @param {boolean} passed - Did it pass curriculum validation?
 */
export function trackLearningPathGenerated(objectives, courses, passed = true) {
  return trackEvent(EVENTS.LEARNING_PATH_GENERATED, {
    fix_specific_count: objectives?.fix_specific?.length || 0,
    transferable_count: objectives?.transferable?.length || 0,
    course_count: courses?.length || 0,
    passed_validation: passed,
  });
}

/**
 * Track when a user skips a module
 * @param {string} moduleId
 * @param {string} reason - Optional reason
 */
export function trackModuleSkipped(moduleId, reason = null) {
  return trackEvent(EVENTS.MODULE_SKIPPED, {
    module_id: moduleId,
    reason,
  });
}

/**
 * Track when a user reorders modules
 * @param {string} moduleId
 * @param {number} fromIndex
 * @param {number} toIndex
 */
export function trackModuleReordered(moduleId, fromIndex, toIndex) {
  return trackEvent(EVENTS.MODULE_REORDERED, {
    module_id: moduleId,
    from_index: fromIndex,
    to_index: toIndex,
  });
}

/**
 * Track session completion
 * @param {string} mode - 'onboarding' or 'problem-first'
 * @param {Object} summary
 */
export function trackSessionCompleted(mode, summary = {}) {
  return trackEvent(EVENTS.SESSION_COMPLETED, {
    mode,
    ...summary,
  });
}

/**
 * Track follow-up query (indicates initial solution wasn't sufficient)
 * @param {string} originalQueryPreview
 * @param {string} followUpQuery
 */
export function trackFollowupQuery(originalQueryPreview, followUpQuery) {
  return trackEvent(EVENTS.FOLLOWUP_QUERY_SUBMITTED, {
    original_preview: originalQueryPreview?.substring(0, 50),
    followup_length: followUpQuery?.length || 0,
    followup_preview: followUpQuery?.substring(0, 100),
  });
}

/**
 * Start a new analytics session
 */
export function startSession() {
  currentSessionId = null; // Reset to generate new ID
  return trackEvent(EVENTS.SESSION_STARTED, {
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    screen_width: typeof window !== "undefined" ? window.innerWidth : 0,
    screen_height: typeof window !== "undefined" ? window.innerHeight : 0,
  });
}

// ── RAG Pipeline Tracking ──────────────────────────────────────────

/**
 * Track vector search completion with quality metrics.
 * @param {Object} params
 * @param {string} params.query - The user query
 * @param {number} params.transcriptCount - Results from transcript collection
 * @param {number} params.epicCount - Results from Epic Learning collection
 * @param {number} params.docsCount - Results from docs collection
 * @param {number} params.bestSimilarity - Highest similarity score
 * @param {number} params.avgSimilarity - Average similarity across all results
 * @param {boolean} params.lowCorpusCoverage - Whether fallback was needed
 * @param {number} params.searchTimeMs - How long the search took
 */
export function trackVectorSearchCompleted(params) {
  return trackEvent(EVENTS.VECTOR_SEARCH_COMPLETED, {
    query_preview: params.query?.substring(0, 80),
    transcript_count: params.transcriptCount || 0,
    epic_count: params.epicCount || 0,
    docs_count: params.docsCount || 0,
    total_segments:
      (params.transcriptCount || 0) + (params.epicCount || 0) + (params.docsCount || 0),
    best_similarity: Number((params.bestSimilarity || 0).toFixed(3)),
    avg_similarity: Number((params.avgSimilarity || 0).toFixed(3)),
    low_corpus_coverage: !!params.lowCorpusCoverage,
    search_time_ms: params.searchTimeMs || 0,
  });
}

/**
 * Track when hybrid AI fallback is triggered.
 * @param {Object} params
 * @param {string} params.reason - Why fallback triggered ("low_similarity" | "post_sequence_empty")
 * @param {number} params.bestSimilarity - Best score that wasn't good enough
 * @param {number} params.corpusSegments - How many corpus segments were available
 */
export function trackHybridFallbackTriggered(params) {
  return trackEvent(EVENTS.HYBRID_FALLBACK_TRIGGERED, {
    reason: params.reason || "unknown",
    best_similarity: Number((params.bestSimilarity || 0).toFixed(3)),
    corpus_segments: params.corpusSegments || 0,
  });
}

/**
 * Track path sequencing completion.
 * @param {Object} params
 * @param {number} params.stepCount - Steps in final path
 * @param {string[]} params.categories - Categories used (foundation, diagnosis, fix, transfer)
 * @param {boolean} params.isAiGenerated - Was AI hybrid fallback used?
 * @param {number} params.corpusRatio - % of steps from real corpus vs AI
 */
export function trackPathSequenced(params) {
  return trackEvent(EVENTS.PATH_SEQUENCED, {
    step_count: params.stepCount || 0,
    categories: params.categories || [],
    is_ai_generated: !!params.isAiGenerated,
    corpus_ratio: Number((params.corpusRatio || 0).toFixed(2)),
  });
}

/**
 * Track when a Blueprint visual link is shown to the user.
 * @param {string} presetKey - The matched preset name
 * @param {string} stepTitle - Title of the step it appeared on
 */
export function trackBlueprintLinkShown(presetKey, stepTitle) {
  return trackEvent(EVENTS.BLUEPRINT_LINK_SHOWN, {
    preset_key: presetKey,
    step_title: stepTitle?.substring(0, 80),
  });
}

export default {
  EVENTS,
  trackEvent,
  trackPersonaDetected,
  trackOnboardingPathGenerated,
  trackQuerySubmitted,
  trackIntentExtracted,
  trackDiagnosisGenerated,
  trackLearningPathGenerated,
  trackModuleSkipped,
  trackModuleReordered,
  trackSessionCompleted,
  trackFollowupQuery,
  startSession,
  trackVectorSearchCompleted,
  trackHybridFallbackTriggered,
  trackPathSequenced,
  trackBlueprintLinkShown,
};
