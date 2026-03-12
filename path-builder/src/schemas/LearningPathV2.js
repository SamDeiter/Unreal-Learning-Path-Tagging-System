/**
 * LearningPathV2.js — Canonical Learner-Facing Path Schema
 *
 * Defines the single source-of-truth format for learning paths.
 * All generators (bespoke, query, hybrid, pre-seeded) MUST be
 * adapted into this shape before rendering.
 *
 * Design goals:
 * - No raw transcript text ever reaches the learner
 * - Explicit section ordering (prerequisite → core → practice)
 * - Every step has a pedagogical summary, not a content description
 * - Backward-compatible via adapter layer (existing generators untouched)
 */

// ── Section phases (explicit order) ────────────────────────────────
export const SECTION_PHASES = ["prerequisite", "core", "practice"];

export const SECTION_LABELS = {
  prerequisite: "📘 Prerequisites",
  core: "📗 Core Lessons",
  practice: "📙 Practice & Transfer",
};

// ── Category → Section mapping ─────────────────────────────────────
// Maps the categories produced by pathSequencer and hybridPath
// into the 3 canonical sections.
export const CATEGORY_TO_SECTION = {
  foundation: "prerequisite",
  diagnosis: "prerequisite",
  prerequisite: "prerequisite",
  fix: "core",
  core: "core",
  transfer: "practice",
  practice: "practice",
};

// ── Transcript artifact patterns ───────────────────────────────────
// Used to detect text that is raw transcript, not pedagogical content.
const TRANSCRIPT_ARTIFACTS = [
  /^\[?\d{1,2}:\d{2}/m,               // Timestamps like "0:42" or "[1:30"
  /\b(um|uh|okay so|you know|like)\b/i, // Filler words
  /^>>\s/m,                             // Speaker labels ">> "
  /^[A-Z]{2,}:\s/m,                     // Speaker labels "SPEAKER: "
  /\bversion selector\b/i,              // Epic docs boilerplate
  /^\s*\n\s*\n\s*\n/,                   // Triple blank lines (bad formatting)
];

const MIN_SUMMARY_LENGTH = 30;

// ── Schema Factory ─────────────────────────────────────────────────

/**
 * Create an empty LearningPathV2 object.
 * @param {Object} overrides — partial fields to set
 * @returns {Object} LearningPathV2
 */
export function createV2Path(overrides = {}) {
  return {
    schemaVersion: 2,
    title: "",
    learnerGoal: "",
    difficulty: "intermediate",
    estimatedMinutes: 0,
    isAiGenerated: false,
    generatedAt: new Date().toISOString(),
    sections: [],
    // Metadata
    _sourceFormat: "", // "bespoke" | "query" | "preseeded" | "hybrid"
    _originalQuery: "",
    ...overrides,
  };
}

/**
 * Create a V2 section.
 * @param {string} phase — "prerequisite" | "core" | "practice"
 * @param {Array} steps — V2 step objects
 * @returns {Object} V2 section
 */
export function createV2Section(phase, steps = []) {
  return {
    id: `section-${phase}`,
    title: SECTION_LABELS[phase] || phase,
    purpose: getSectionPurpose(phase),
    phase,
    steps,
  };
}

function getSectionPurpose(phase) {
  switch (phase) {
    case "prerequisite":
      return "Background concepts and context you need before diving in.";
    case "core":
      return "The main implementation — step-by-step guidance to solve the problem.";
    case "practice":
      return "Apply and transfer your new knowledge to related scenarios.";
    default:
      return "";
  }
}

/**
 * Create a V2 step.
 * @param {Object} fields — step fields
 * @returns {Object} V2 step
 */
export function createV2Step(fields = {}) {
  return {
    id: fields.id || `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: fields.title || "Untitled Step",
    summary: fields.summary || "",
    whyThisMatters: fields.whyThisMatters || "",
    takeaway: fields.takeaway || "",
    category: fields.category || "core",
    source: fields.source || {},
    video: fields.video || null,
    estimatedMinutes: fields.estimatedMinutes || 3,
    // Pass-through fields for backward compat
    _originalSegment: fields._originalSegment || null,
    _bridgeText: fields._bridgeText || "",
  };
}

// ── Validation ─────────────────────────────────────────────────────

/**
 * Check if text looks like raw transcript rather than pedagogical content.
 * @param {string} text
 * @returns {{ isTranscript: boolean, reasons: string[] }}
 */
export function detectTranscriptArtifacts(text) {
  if (!text) return { isTranscript: false, reasons: [] };
  const reasons = [];
  for (const pattern of TRANSCRIPT_ARTIFACTS) {
    if (pattern.test(text)) {
      reasons.push(pattern.source);
    }
  }
  return { isTranscript: reasons.length >= 2, reasons };
}

/**
 * Validate a LearningPathV2 object.
 * Returns warnings (non-blocking) and errors (blocking).
 *
 * @param {Object} v2Path — LearningPathV2 object
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateV2Path(v2Path) {
  const errors = [];
  const warnings = [];

  if (!v2Path) {
    return { valid: false, errors: ["Path is null or undefined"], warnings };
  }

  // Schema version
  if (v2Path.schemaVersion !== 2) {
    warnings.push(`Unexpected schemaVersion: ${v2Path.schemaVersion}`);
  }

  // Title
  if (!v2Path.title || v2Path.title.length < 5) {
    warnings.push("Path title is missing or too short");
  }

  // Sections
  if (!v2Path.sections || v2Path.sections.length === 0) {
    errors.push("Path has no sections");
    return { valid: false, errors, warnings };
  }

  // Per-section checks
  let totalSteps = 0;
  for (const section of v2Path.sections) {
    if (!section.steps || section.steps.length === 0) {
      warnings.push(`Section "${section.phase}" has no steps`);
      continue;
    }
    totalSteps += section.steps.length;

    // Per-step checks
    for (const step of section.steps) {
      // Title quality
      if (!step.title || step.title === "Untitled Step") {
        warnings.push(`Step "${step.id}" has no title`);
      }

      // Summary quality
      if (!step.summary) {
        warnings.push(`Step "${step.title}" has no summary`);
      } else if (step.summary.length < MIN_SUMMARY_LENGTH) {
        warnings.push(`Step "${step.title}" summary is very short (${step.summary.length} chars)`);
      }

      // Transcript leak check
      const { isTranscript, reasons } = detectTranscriptArtifacts(step.summary);
      if (isTranscript) {
        warnings.push(
          `Step "${step.title}" summary may contain raw transcript (${reasons.length} artifacts detected)`
        );
      }
    }
  }

  if (totalSteps === 0) {
    errors.push("Path has sections but no steps");
  }

  return { valid: errors.length === 0, errors, warnings };
}
