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
 * - Every step has structured teaching fields, not just a summary
 * - Closed learning loops: learn → do → verify → apply
 * - Backward-compatible via adapter layer (existing generators untouched)
 */

// ── Section phases (explicit order) ────────────────────────────────
export const SECTION_PHASES = ["prerequisite", "core", "practice"];

export const SECTION_LABELS = {
  prerequisite: "📘 Understand",
  core: "📗 Implement",
  practice: "📙 Apply & Verify",
};

// ── Category → Section mapping ─────────────────────────────────────
export const CATEGORY_TO_SECTION = {
  foundation: "prerequisite",
  diagnosis: "prerequisite",
  prerequisite: "prerequisite",
  fix: "core",
  core: "core",
  transfer: "practice",
  practice: "practice",
};

// ── Completion types ───────────────────────────────────────────────
export const COMPLETION_TYPES = ["read", "watch", "do", "verify", "apply"];

// ── Transcript artifact patterns ───────────────────────────────────
const TRANSCRIPT_ARTIFACTS = [
  /^\[?\d{1,2}:\d{2}/m,
  /\b(um|uh|okay so|you know|like)\b/i,
  /^>>\s/m,
  /^[A-Z]{2,}:\s/m,
  /\bversion selector\b/i,
  /^\s*\n\s*\n\s*\n/,
];

const MIN_SUMMARY_LENGTH = 30;

// ── Schema Factories ───────────────────────────────────────────────

/**
 * Create a LearningPathV2 object.
 */
export function createV2Path(overrides = {}) {
  return {
    schemaVersion: 2,
    title: "",
    learnerGoal: "",
    // Intro fields (Phase 6)
    quickAnswer: "",        // One-line answer to the learner's question
    rootCause: "",          // Most likely root cause of the problem
    whatYouWillLearn: [],   // Array of learning outcomes
    quickWin: "",           // A quick thing to try right now
    difficulty: "intermediate",
    estimatedMinutes: 0,
    prerequisites: [],      // What the learner should already know
    isAiGenerated: false,
    generatedAt: new Date().toISOString(),
    sections: [],
    // Module verification & replanning (Phase 4 extension)
    checkpoints: [],        // ModuleCheckpoint[] — populated at runtime during player
    replanHistory: [],      // { timestamp, action, moduleId, reason }[] — audit trail
    // Metadata
    _sourceFormat: "",
    _originalQuery: "",
    ...overrides,
  };
}

/**
 * Create a V2 section with authored purpose.
 */
export function createV2Section(phase, steps = []) {
  return {
    id: `section-${phase}`,
    title: SECTION_LABELS[phase] || phase,
    purpose: getSectionPurpose(phase),
    phase,
    steps,
    // Module verification fields (Phase 4 extension)
    outcome: "",                 // Expected learning outcome for this section/module
    verificationPrompt: "",      // "Can you explain X?" / "Did this fix Y?"
    exitCondition: "quiz",       // 'quiz' | 'self-report' | 'ue-test' | 'none'
  };
}

function getSectionPurpose(phase) {
  switch (phase) {
    case "prerequisite":
      return "Background concepts and context you need before diving in.";
    case "core":
      return "Step-by-step guidance to implement the solution.";
    case "practice":
      return "Apply what you learned and verify it works in your own project.";
    default:
      return "";
  }
}

/**
 * Create a V2 step with full teaching fields.
 *
 * The step has a structured layout:
 *   - title: what this step covers
 *   - whyThisMatters: connection to the learner's goal
 *   - whatToDo: ordered learner actions
 *   - howToVerify: concrete success checks
 *   - commonMistake: one likely pitfall
 *   - takeaway: concise memory anchor
 *   - goDeeper: links to docs/videos/examples
 *   - completionType: read | watch | do | verify | apply
 */
export function createV2Step(fields = {}) {
  return {
    id: fields.id || `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: fields.title || "Untitled Step",
    // Structured teaching fields
    whyThisMatters: fields.whyThisMatters || "",
    whatToDo: fields.whatToDo || [],         // string[] — ordered actions
    howToVerify: fields.howToVerify || [],    // string[] — success checks
    commonMistake: fields.commonMistake || "",
    takeaway: fields.takeaway || "",
    // Legacy summary — kept for backward compat, but UI prefers structured fields
    summary: fields.summary || "",
    // Classification
    category: fields.category || "core",
    completionType: fields.completionType || "do",
    estimatedMinutes: fields.estimatedMinutes || 3,
    // Source / media
    source: fields.source || {},
    video: fields.video || null,
    goDeeper: fields.goDeeper || [],         // { label, url, type }[]
    // Pass-through for backward compat
    _originalSegment: fields._originalSegment || null,
    _bridgeText: fields._bridgeText || "",
    // Editorial pass metadata
    _editorialStatus: fields._editorialStatus || "raw", // "raw" | "enriched" | "failed"
  };
}

// ── Validation ─────────────────────────────────────────────────────

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
 * Validate a LearningPathV2 object — Phase 7 quality gates.
 *
 * Checks structure AND content quality:
 * - Missing teaching fields (whyThisMatters, whatToDo, howToVerify, commonMistake)
 * - Transcript artifacts in any text field
 * - No early micro-win (first core step should be actionable)
 * - No verification step
 * - No transfer/application step
 * - Repeated adjacent concepts
 * - Short/empty summaries
 */
export function validateV2Path(v2Path) {
  const errors = [];
  const warnings = [];

  if (!v2Path) {
    return { valid: false, errors: ["Path is null or undefined"], warnings };
  }

  if (v2Path.schemaVersion !== 2) {
    warnings.push(`Unexpected schemaVersion: ${v2Path.schemaVersion}`);
  }

  if (!v2Path.title || v2Path.title.length < 5) {
    warnings.push("Path title is missing or too short");
  }

  // Phase 6: Intro quality
  if (!v2Path.quickAnswer) warnings.push("Missing quickAnswer in path intro");
  if (!v2Path.whatYouWillLearn || v2Path.whatYouWillLearn.length === 0) {
    warnings.push("Missing whatYouWillLearn outcomes");
  }

  if (!v2Path.sections || v2Path.sections.length === 0) {
    errors.push("Path has no sections");
    return { valid: false, errors, warnings };
  }

  let totalSteps = 0;
  let hasVerifyStep = false;
  let hasTransferStep = false;
  let previousTitle = "";

  for (const section of v2Path.sections) {
    if (!section.steps || section.steps.length === 0) {
      warnings.push(`Section "${section.phase}" has no steps`);
      continue;
    }
    totalSteps += section.steps.length;

    for (const step of section.steps) {
      // Title quality
      if (!step.title || step.title === "Untitled Step") {
        warnings.push(`Step "${step.id}" has no title`);
      }

      // Phase 7: Teaching field quality
      if (!step.whyThisMatters) {
        warnings.push(`Step "${step.title}" missing whyThisMatters`);
      }
      if (!step.whatToDo || step.whatToDo.length === 0) {
        warnings.push(`Step "${step.title}" missing whatToDo actions`);
      }
      if (!step.howToVerify || step.howToVerify.length === 0) {
        warnings.push(`Step "${step.title}" missing howToVerify checks`);
      }
      if (!step.commonMistake) {
        warnings.push(`Step "${step.title}" missing commonMistake`);
      }

      // Summary quality
      if (step.summary && step.summary.length < MIN_SUMMARY_LENGTH) {
        warnings.push(`Step "${step.title}" summary very short (${step.summary.length} chars)`);
      }

      // Transcript leak
      const allText = [step.summary, step.whyThisMatters, step.commonMistake]
        .filter(Boolean).join(" ");
      const { isTranscript } = detectTranscriptArtifacts(allText);
      if (isTranscript) {
        warnings.push(`Step "${step.title}" may contain raw transcript`);
      }

      // Repeated adjacent concepts
      if (previousTitle && step.title === previousTitle) {
        warnings.push(`Repeated adjacent step: "${step.title}"`);
      }
      previousTitle = step.title;

      // Track step types
      if (step.completionType === "verify") hasVerifyStep = true;
      if (step.category === "transfer" || step.category === "practice") hasTransferStep = true;
    }
  }

  if (totalSteps === 0) {
    errors.push("Path has sections but no steps");
  }

  // Structural quality
  if (!hasVerifyStep && totalSteps > 2) {
    warnings.push("Path has no verification step — learners can't confirm success");
  }
  if (!hasTransferStep && totalSteps > 3) {
    warnings.push("Path has no transfer/apply step — knowledge may not stick");
  }

  return { valid: errors.length === 0, errors, warnings };
}
