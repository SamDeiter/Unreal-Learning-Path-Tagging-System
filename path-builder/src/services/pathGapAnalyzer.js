/**
 * pathGapAnalyzer.js — Barrel Re-Export
 *
 * This file re-exports all gap analysis functions from their
 * dedicated modules. Consumer imports remain unchanged.
 *
 * Modules:
 *   - gapDetection.js:       analyzePathGaps, extractSubtopics, generateRequiredSubtopics
 *   - gapFill.js:            generateGapFillStep, generateBespokeGapStep
 *   - communityPainPoints.js: searchCommunityPainPoints
 *   - personaGaps.js:        simulatePersonaGaps
 *   - prereqChain.js:        buildPrereqChain
 */

// Gap detection & analysis
export {
  analyzePathGaps,
  extractSubtopics,
  generateRequiredSubtopics,
  parseGeminiJSON,
  RESEARCH_LABELS,
  RESEARCH_CONTEXT,
  MAX_SUBTOPICS,
} from "./gapDetection";

// 3-tier gap filling
export { generateGapFillStep, generateBespokeGapStep } from "./gapFill";

// Community pain point search
export { searchCommunityPainPoints } from "./communityPainPoints";

// Persona simulation
export { simulatePersonaGaps } from "./personaGaps";

// Prerequisite chain builder
export { buildPrereqChain } from "./prereqChain";
