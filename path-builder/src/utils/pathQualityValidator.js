/**
 * pathQualityValidator.js — Post-generation quality gate for AI-generated learning paths.
 *
 * Runs AFTER the AI returns path results but BEFORE displaying them.
 * Catches hallucinated terms, duplicate segments, and imprecise phrasing
 * that the prompt guardrails may miss.
 *
 * @module pathQualityValidator
 */

/**
 * Known bad phrases and their corrections.
 * The AI sometimes says "without code" for Blueprints, which is misleading —
 * Blueprints ARE visual code.
 */
const PHRASE_CORRECTIONS = [
  { pattern: /without\s+(?:any\s+)?code/gi, replacement: "without writing C++ or text-based code" },
  { pattern: /no\s+code\s+(?:is\s+)?(?:needed|required)/gi, replacement: "no C++ code is needed" },
  {
    pattern: /no\s+coding\s+(?:is\s+)?(?:needed|required)/gi,
    replacement: "no C++ coding is needed",
  },
  { pattern: /without\s+(?:any\s+)?programming/gi, replacement: "without text-based programming" },
  { pattern: /don['']t\s+need\s+(?:to\s+)?code/gi, replacement: "don't need to write C++ code" },
];

/**
 * Validate and clean an AI-generated learning path.
 *
 * @param {Array<Object>} pathSteps - The parsed path steps from the AI
 * @param {Array<Object>} sourceSegments - The original source segments fed to the AI
 * @returns {{ cleanedPath: Array<Object>, warnings: string[], autoFixes: string[] }}
 */
export function validatePathQuality(pathSteps, sourceSegments = []) {
  if (!pathSteps || !Array.isArray(pathSteps)) {
    return { cleanedPath: pathSteps || [], warnings: ["No path steps to validate"], autoFixes: [] };
  }

  const warnings = [];
  const autoFixes = [];

  // ── 1. DEDUPLICATION: Remove duplicate segment indices across categories ──
  const seenIndices = new Set();
  const cleanedPath = [];

  for (const step of pathSteps) {
    const segIndex = step.segmentIndex ?? step.segment_index ?? step.index;

    if (segIndex !== undefined && segIndex !== null && seenIndices.has(segIndex)) {
      autoFixes.push(
        `Removed duplicate segment index ${segIndex} (title: "${step.segment?.title || "unknown"}", category: ${step.category})`
      );
      continue; // Skip duplicate
    }

    if (segIndex !== undefined && segIndex !== null) {
      seenIndices.add(segIndex);
    }

    cleanedPath.push(step);
  }

  // ── 2. PHRASING CORRECTIONS: Fix "without code" → "without writing C++ code" ──
  for (const step of cleanedPath) {
    if (step.summary) {
      let corrected = step.summary;
      for (const { pattern, replacement } of PHRASE_CORRECTIONS) {
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
        if (pattern.test(corrected)) {
          pattern.lastIndex = 0;
          corrected = corrected.replace(pattern, replacement);
          autoFixes.push(
            `Fixed phrasing in step "${step.segment?.title || "unknown"}": applied "${replacement}" correction`
          );
        }
      }
      step.summary = corrected;
    }
  }

  // ── 3. HALLUCINATION CHECK: Scan summaries for UE5 terms not in source text ──
  if (sourceSegments.length > 0) {
    // Build a normalized word set from all source text
    const sourceText = sourceSegments
      .map((s) => `${s.text || ""} ${s.title || ""} ${s.videoTitle || ""}`)
      .join(" ")
      .toLowerCase();

    // Known UE5-specific terms that are red flags if invented
    const UE5_SPECIFIC_TERMS = [
      "depth volume",
      "wind volume",
      "fog volume",
      "weather volume",
      "ai controller",
      "behavior tree",
      "blackboard",
      "nanite",
      "lumen",
      "niagara",
      "mass entity",
      "world partition",
      "control rig",
      "metahuman",
      "modeling mode",
      "texture graph",
      "chaos physics",
      "pcg",
      "procedural content generation",
    ];

    for (const step of cleanedPath) {
      if (!step.summary) continue;
      const summaryLower = step.summary.toLowerCase();

      for (const term of UE5_SPECIFIC_TERMS) {
        if (summaryLower.includes(term) && !sourceText.includes(term)) {
          warnings.push(
            `⚠️ Potential hallucination: "${term}" found in summary for "${step.segment?.title || "unknown"}" but NOT in source text`
          );
        }
      }
    }
  }

  // ── 4. TITLE DEDUP: Remove steps with duplicate titles (keep first) ──
  const seenTitles = new Set();
  const dedupedPath = [];
  for (const step of cleanedPath) {
    const title = (step.segment?.title || step.segment?.videoTitle || "").toLowerCase().trim();
    if (!title) {
      dedupedPath.push(step);
      continue;
    }
    if (seenTitles.has(title)) {
      autoFixes.push(
        `Removed duplicate titled step: "${title}" (category: ${step.category})`
      );
      continue; // Skip duplicate
    }
    seenTitles.add(title);
    dedupedPath.push(step);
  }

  // Re-number orders after dedup
  dedupedPath.forEach((s, i) => { s.order = i; });

  return { cleanedPath: dedupedPath, warnings, autoFixes };
}
