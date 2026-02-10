/**
 * Analytics Service - Centralized event tracking for learning intelligence
 * Tracks events to answer:
 * - Where do learners get stuck?
 * - Which diagnostics reduce repeat failures?
 * - Which personas override system suggestions?
 * - Does problem-first learning reduce drop-off?
 */

import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

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
    const db = getFirestore();

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
};
