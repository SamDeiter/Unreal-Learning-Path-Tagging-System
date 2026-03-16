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

  // Content Gap Intelligence
  AI_COVERAGE_REPORT: "ai_coverage_report",
  GAP_FILL_ACTION: "gap_fill_action",
  GAP_FILL_COMPLETED: "gap_fill_completed",
  GAP_EXPLORE_ACTION: "gap_explore_action",

  // Step-level Feedback
  AI_STEP_FEEDBACK: "ai_step_feedback",
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

// ── Content Gap Intelligence ───────────────────────────────────────

/**
 * Track AI content gap coverage for a generated path.
 * Fired once per path generation to capture where official docs fall short.
 * @param {Object} params
 * @param {string} params.query - User's original query
 * @param {string} params.learnerLevel - From knowledge profile (beginner/intermediate/advanced)
 * @param {string[]} params.knowledgeGaps - Concepts the learner doesn't know
 * @param {number} params.totalSteps - Total steps in the path
 * @param {number} params.corpusSteps - Steps from real corpus content
 * @param {number} params.aiGeneratedSteps - Steps AI had to generate
 * @param {boolean} params.lowCorpusCoverage - Whether corpus coverage was low
 * @param {Object[]} [params.blindSpots] - Gap analysis blind spots
 * @param {number} [params.coverageScore] - 0-1 coverage score from gap analysis
 * @param {Object[]} [params.communityPainPoints] - Community struggle points
 * @param {number} [params.gapFillCount] - Number of gap fills applied
 */
export async function trackAICoverageReport(params) {
  const total = params.totalSteps || 0;
  const aiSteps = params.aiGeneratedSteps || 0;
  const payload = {
    query_preview: params.query?.substring(0, 100),
    learner_level: params.learnerLevel || "unknown",
    knowledge_gaps: (params.knowledgeGaps || []).slice(0, 10),
    total_steps: total,
    corpus_steps: params.corpusSteps || 0,
    ai_generated_steps: aiSteps,
    ai_ratio: total > 0 ? Number((aiSteps / total).toFixed(2)) : 0,
    low_corpus_coverage: !!params.lowCorpusCoverage,
    // Phase 4 enhancements
    blind_spots: (params.blindSpots || []).slice(0, 10).map((b) => ({
      topic: b.topic?.substring(0, 80),
      severity: b.severity || "medium",
    })),
    coverage_score: params.coverageScore != null ? Number(params.coverageScore.toFixed(2)) : null,
    community_pain_points: (params.communityPainPoints || []).slice(0, 5).map((p) => ({
      topic: (p.topic || p.title)?.substring(0, 80),
    })),
    gap_fill_count: params.gapFillCount || 0,
  };
  devLog("[Analytics] Firing AI_COVERAGE_REPORT:", payload);
  try {
    await trackEvent(EVENTS.AI_COVERAGE_REPORT, payload);
    devLog("[Analytics] AI_COVERAGE_REPORT written successfully");
  } catch (err) {
    devWarn("[Analytics] AI_COVERAGE_REPORT FAILED:", err.message, err);
  }
}

/**
 * Track when a user fills a gap (adds a step to cover a blind spot).
 * @param {string} topic - The blind spot topic
 * @param {string} severity - high/medium/low
 * @param {string} queryPreview - First 100 chars of user query
 */
export function trackGapFillAction(topic, severity, queryPreview) {
  return trackEvent(EVENTS.GAP_FILL_ACTION, {
    topic: topic?.substring(0, 80),
    severity: severity || "medium",
    query_preview: queryPreview?.substring(0, 100),
  });
}

/**
 * Track when a user explores a gap topic (opens external search).
 * @param {string} topic - The blind spot topic
 * @param {string} queryPreview - First 100 chars of user query
 */
export function trackGapExploreAction(topic, queryPreview) {
  return trackEvent(EVENTS.GAP_EXPLORE_ACTION, {
    topic: topic?.substring(0, 80),
    query_preview: queryPreview?.substring(0, 100),
  });
}

/**
 * Track the outcome of a gap fill attempt: which tier was used and whether accepted.
 * @param {string} topic - The blind spot topic
 * @param {string} tier - "library" | "bespoke" | "ai" | "error"
 * @param {boolean} accepted - Whether the user accepted the fill
 * @param {string} queryPreview - First 100 chars of user query
 */
export function trackGapFillCompleted(topic, tier, accepted, queryPreview) {
  return trackEvent(EVENTS.GAP_FILL_COMPLETED, {
    topic: topic?.substring(0, 80),
    tier: tier || "unknown",
    accepted: !!accepted,
    query_preview: queryPreview?.substring(0, 100),
  });
}

// ── Step-Level Feedback ────────────────────────────────────────────

/**
 * Track when a user gives 👍/👎 feedback on an AI-generated step.
 * This supplements the Firestore `stepFeedback` collection write
 * with an analytics event for trend analysis in ContentGaps.
 *
 * @param {string} stepTitle - Title of the step receiving feedback
 * @param {string} category - Step category (foundation, diagnosis, fix, etc.)
 * @param {string} queryPreview - First 100 chars of the originating query
 * @param {string} feedback - "positive" or "negative"
 * @param {string} [reason] - Optional freeform reason
 */
export function trackAIStepFeedback(stepTitle, category, queryPreview, feedback, reason = null) {
  return trackEvent(EVENTS.AI_STEP_FEEDBACK, {
    step_title: stepTitle?.substring(0, 120),
    category: category || "unknown",
    query_preview: queryPreview?.substring(0, 100),
    feedback, // "positive" | "negative"
    reason,
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
  trackAICoverageReport,
  trackAIStepFeedback,
  trackGapFillAction,
  trackGapFillCompleted,
  trackGapExploreAction,
};
