/**
 * summaryQualityGate.js — Prevents raw transcript text from reaching learners.
 *
 * Single responsibility: given raw text, determine if it's learner-quality.
 * If not, replace it with a clean descriptive placeholder.
 *
 * Used by: pathAdapter.js, webPlayerService.js, PathStep.jsx, scormPackager.js
 */

import { cleanTranscriptText } from "./cleanTranscriptText";

// ── Patterns that indicate raw/unedited transcript ─────────────────
const TRANSCRIPT_PATTERNS = [
  { pattern: /^\[?\d{1,2}:\d{2}/m, reason: "timestamp" },
  { pattern: /\b(um|uh|okay so)\b/i, reason: "filler_word" },
  { pattern: /^>>\s/m, reason: "speaker_label" },
  { pattern: /^[A-Z]{2,}:\s/m, reason: "speaker_prefix" },
  { pattern: /\bversion selector\b/i, reason: "epic_boilerplate" },
  { pattern: /\bclick here to\b/i, reason: "docs_boilerplate" },
  { pattern: /\btranscript\b.*\bgenerated\b/i, reason: "transcript_meta" },
];

// ── Conversational speech patterns (instant reject) ────────────────
const CONVERSATIONAL_PATTERNS = [
  { pattern: /\b(I'm going to|I'm gonna|I was going to|I'll go ahead)\b/i, reason: "first_person_speech" },
  { pattern: /\b(we're going to|we're gonna|let's go ahead|let's go)\b/i, reason: "first_person_plural" },
  { pattern: /\b(so to start with|so we can|so what we)\b/i, reason: "verbal_transition" },
  { pattern: /\bgoing to come on to\b/i, reason: "verbal_direction" },
  { pattern: /\b(right no\b|right here|over here)\b/i, reason: "spatial_reference" },
  { pattern: /\.\s+(And|But|So|OK|Okay)\s+/g, reason: "run_on_speech" },
  { pattern: /\b(Maybe double check|make sure that's working)\b/i, reason: "verbal_hedging" },
  { pattern: /\bAll of this can be\b/i, reason: "verbal_demonstration" },
  { pattern: /\bwe set our\b.*\bto\b/i, reason: "verbal_walkthrough" },
  { pattern: /\bI'm going to call this\b/i, reason: "narrated_action" },
];

const MIN_QUALITY_LENGTH = 30;

// ── Category display labels for placeholders ───────────────────────
const CATEGORY_LABELS = {
  foundation: "foundational",
  diagnosis: "diagnostic",
  prerequisite: "prerequisite",
  fix: "implementation",
  core: "core",
  transfer: "transfer and application",
  practice: "practice",
};

/**
 * Ensure a summary meets minimum quality standards for learner display.
 *
 * Pipeline:
 *   1. Run through cleanTranscriptText (existing utility)
 *   2. Check for transcript artifacts
 *   3. Check minimum length
 *   4. If failing → generate descriptive placeholder
 *
 * @param {string} rawText — raw summary/text from any pipeline
 * @param {string} stepTitle — the step's display title (for placeholder generation)
 * @param {string} category — step category (for placeholder context)
 * @returns {{ text: string, wasReplaced: boolean, reason: string }}
 */
export function ensureQualitySummary(rawText, stepTitle = "this topic", category = "core") {
  // Step 1: Clean transcript artifacts
  let cleaned = cleanTranscriptText(rawText || "");

  // Step 2: If empty after cleaning, generate placeholder directly
  if (!cleaned || cleaned.trim().length === 0) {
    return {
      text: generatePlaceholder(stepTitle, category),
      wasReplaced: true,
      reason: "empty_after_cleaning",
    };
  }

  // Step 3: Check for conversational speech (instant reject — single match)
  for (const { pattern, reason } of CONVERSATIONAL_PATTERNS) {
    if (pattern.test(cleaned)) {
      return {
        text: generatePlaceholder(stepTitle, category),
        wasReplaced: true,
        reason: `conversational_speech: ${reason}`,
      };
    }
  }

  // Step 4: Check for remaining transcript artifacts
  const detectedArtifacts = [];
  for (const { pattern, reason } of TRANSCRIPT_PATTERNS) {
    if (pattern.test(cleaned)) {
      detectedArtifacts.push(reason);
    }
  }

  // If 2+ transcript patterns detected, it's raw transcript
  if (detectedArtifacts.length >= 2) {
    return {
      text: generatePlaceholder(stepTitle, category),
      wasReplaced: true,
      reason: `transcript_artifacts: ${detectedArtifacts.join(", ")}`,
    };
  }

  // Step 5: Check minimum length
  if (cleaned.trim().length < MIN_QUALITY_LENGTH) {
    return {
      text: generatePlaceholder(stepTitle, category),
      wasReplaced: true,
      reason: "too_short",
    };
  }

  // Passed all checks — return cleaned text
  return {
    text: cleaned.trim(),
    wasReplaced: false,
    reason: "",
  };
}

/**
 * Generate a clean placeholder summary when source text is unusable.
 * @param {string} stepTitle
 * @param {string} category
 * @returns {string}
 */
function generatePlaceholder(stepTitle, category) {
  const catLabel = CATEGORY_LABELS[category] || "core";
  const title = stepTitle || "this topic";
  return `Learn about ${title} — this ${catLabel} lesson covers key concepts and techniques in Unreal Engine 5.`;
}
