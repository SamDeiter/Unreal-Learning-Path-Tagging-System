/**
 * personaGaps.js — Persona Gap Simulation
 *
 * Re-runs gap analysis from different persona perspectives
 * (beginner, intermediate, advanced) using synthetic knowledge profiles.
 *
 * Exports:
 *   - simulatePersonaGaps()
 */

import { devLog } from "../utils/logger";
import { analyzePathGaps } from "./gapDetection";

/**
 * Re-run gap analysis from a different persona perspective.
 * Uses the same knowledgeProfile format as useAdaptiveQuiz:
 *   { knows: [], gaps: [], level: "beginner"|"intermediate"|"advanced" }
 *
 * @param {string} query - The user's original question
 * @param {Array} steps - The path steps
 * @param {string} persona - "beginner", "intermediate", or "advanced"
 * @returns {Promise<Object>} Same shape as analyzePathGaps()
 */
export async function simulatePersonaGaps(query, steps, persona = "beginner") {
  // Build a synthetic knowledge profile for the persona
  const personaProfile = {
    level: persona,
    knows: [],
    gaps: [],
  };

  // Persona-specific gap assumptions
  switch (persona) {
    case "beginner":
      personaProfile.gaps = [
        "editor_navigation",
        "blueprint_basics",
        "project_structure",
        "asset_pipeline",
      ];
      break;
    case "intermediate":
      personaProfile.gaps = ["optimization", "advanced_blueprints"];
      personaProfile.knows = ["editor_navigation", "blueprint_basics", "material_basics"];
      break;
    case "advanced":
      personaProfile.knows = [
        "editor_navigation",
        "blueprint_basics",
        "material_basics",
        "animation_basics",
        "optimization",
        "advanced_blueprints",
      ];
      break;
    default:
      break;
  }

  devLog(`[GapAnalyzer] Simulating gaps for persona: ${persona}`);
  return analyzePathGaps(query, steps, personaProfile);
}
