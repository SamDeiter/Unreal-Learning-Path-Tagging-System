/**
 * PersonaService - Detects user persona from learning goals and selected tags
 * Supports multiple industries: Games, Film/Animation, Character TD, Retail/CPG, Architecture, Industrial, VFX, Automotive
 */

import personasData from "../data/personas.json";

/**
 * Detect the most likely persona based on learning goal text and selected tags
 * @param {string} learningGoal - The user's stated learning goal
 * @param {string[]} selectedTags - Array of selected tag names
 * @returns {Object|null} - The detected persona or null if no match
 */
export function detectPersona(learningGoal = "", selectedTags = []) {
  const goalLower = learningGoal.toLowerCase();
  const tagsLower = selectedTags.map((t) => t.toLowerCase());
  const combinedText = `${goalLower} ${tagsLower.join(" ")}`;

  let bestMatch = null;
  let highestScore = 0;

  for (const persona of personasData.personas) {
    let score = 0;

    // Check each keyword
    for (const keyword of persona.keywords) {
      const keywordLower = keyword.toLowerCase();

      // Exact word match in goal (higher weight)
      if (goalLower.includes(keywordLower)) {
        score += 3;
      }

      // Match in tags
      if (tagsLower.some((tag) => tag.includes(keywordLower))) {
        score += 2;
      }

      // Partial match in combined text
      if (combinedText.includes(keywordLower)) {
        score += 1;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = persona;
    }
  }

  // Require minimum score threshold
  if (highestScore >= 3) {
    return {
      ...bestMatch,
      confidence: Math.min(highestScore / 15, 1), // Normalize to 0-1
      matchScore: highestScore,
    };
  }

  return null;
}

/**
 * Get all available personas
 * @returns {Object[]} - Array of all persona objects
 */
export function getAllPersonas() {
  return personasData.personas;
}

/**
 * Get only the 5 onboarding-primary personas (shown in the onboarding quiz)
 * @returns {Object[]}
 */
export function getOnboardingPersonas() {
  return personasData.personas.filter((p) => p.onboardingPrimary);
}

/**
 * Get a specific persona by ID
 * @param {string} personaId - The persona ID
 * @returns {Object|null} - The persona or null if not found
 */
export function getPersonaById(personaId) {
  return personasData.personas.find((p) => p.id === personaId) || null;
}

/**
 * Get pain point / onboarding messaging for a persona.
 * Prefers the JSON-driven `onboardingMessaging` field; falls back to hardcoded map.
 * @param {Object} persona - The persona object
 * @returns {string[]} - Array of messaging strings
 */
export function getPainPointMessaging(persona) {
  if (!persona) return [];

  // Prefer JSON-driven field
  if (Array.isArray(persona.onboardingMessaging) && persona.onboardingMessaging.length > 0) {
    return persona.onboardingMessaging;
  }

  // Legacy fallback (will rarely trigger now that all entries have onboardingMessaging)
  const legacyMessaging = {
    gamedev_gary: [
      "🎮 Industry-standard for AAA and indie games",
      "⚡ Blueprint visual scripting - no C++ required to start",
      "🌐 Deploy to PC, console, and mobile",
    ],
  };

  return legacyMessaging[persona.id] || [];
}

// ─────────── Persona-Specific Scoring Rules ───────────
// Used by generatePath() in Personas.jsx to rank courses per persona.
// boostKeywords:   +5 title match, +3 tag match
// penaltyKeywords: -10 per match
// requiredTopics:  ensure at least 1 course covers each (swap in if missing)
export const personaScoringRules = {
  indie_isaac: {
    boostKeywords: [
      "blueprint", "gameplay", "prototype", "interaction", "UI", "UMG",
      "save game", "inventory", "input", "level design", "your first",
      "getting started", "project", "widget", "player controller",
    ],
    penaltyKeywords: [
      "deep C++", "networking", "multiplayer", "dedicated server",
      "mass production", "automotive", "archviz",
    ],
    requiredTopics: ["viewport", "blueprint", "lighting", "packaging"],
  },
  logic_liam: {
    boostKeywords: [
      "C++", "architecture", "systems", "framework", "subsystem",
      "profiling", "optimization", "GAS", "gameplay ability",
      "replication", "networking", "debugging", "performance",
      "memory", "API", "programming",
    ],
    penaltyKeywords: [
      "marketing", "brand", "product viz", "archviz",
      "automotive", "configurator",
    ],
    requiredTopics: ["blueprint", "C++", "profiling"],
  },
  animator_alex: {
    boostKeywords: [
      "animation", "sequencer", "cinematic", "character", "mocap",
      "keyframe", "motion", "camera", "performance", "acting",
      "lighting", "storytelling", "retarget",
    ],
    penaltyKeywords: [
      "networking", "multiplayer", "dedicated server", "automotive",
      "archviz", "digital twin", "manufacturing",
    ],
    requiredTopics: ["animation", "sequencer", "lighting"],
  },
  rigger_regina: {
    boostKeywords: [
      "control rig", "IK", "FK", "constraint", "deformation",
      "skinning", "retarget", "skeleton", "bone", "joint",
      "weight", "character", "rig", "animation",
    ],
    penaltyKeywords: [
      "networking", "multiplayer", "automotive", "archviz",
      "marketing", "brand", "digital twin",
    ],
    requiredTopics: ["animation", "control rig", "character"],
  },
  designer_cpg: {
    boostKeywords: [
      "lighting", "materials", "lookdev", "product viz", "motion design",
      "camera", "presentation", "rendering", "photorealistic",
      "studio", "environment", "scene", "visualization",
    ],
    penaltyKeywords: [
      "deep C++", "networking", "multiplayer", "dedicated server",
      "GAS", "gameplay ability", "digital twin",
    ],
    requiredTopics: ["lighting", "materials", "camera"],
  },
  // Legacy personas get basic rules for consistency
  architect_amy: {
    boostKeywords: [
      "archviz", "architectural", "interior", "building", "walkthrough",
      "visualization", "real estate", "photorealistic", "twinmotion",
    ],
    penaltyKeywords: ["multiplayer", "gameplay", "automotive", "manufacturing"],
    requiredTopics: ["lighting", "materials"],
  },
  simulation_sam: {
    boostKeywords: [
      "simulation", "digital twin", "training", "enterprise", "industrial",
      "defense", "manufacturing", "factory",
    ],
    penaltyKeywords: ["archviz", "automotive", "gameplay", "indie"],
    requiredTopics: ["blueprint", "simulation"],
  },
  vfx_victor: {
    boostKeywords: [
      "vfx", "effects", "compositing", "particles", "niagara",
      "explosion", "destruction", "smoke", "fire", "post-process",
    ],
    penaltyKeywords: ["archviz", "automotive", "manufacturing", "digital twin"],
    requiredTopics: ["niagara", "effects"],
  },
  automotive_andy: {
    boostKeywords: [
      "automotive", "vehicle", "car", "configurator", "showroom",
      "paint", "headlight", "wheel", "dashboard", "lighting studio",
    ],
    penaltyKeywords: ["archviz", "gameplay", "digital twin", "multiplayer"],
    requiredTopics: ["materials", "lighting"],
  },
};

export default {
  detectPersona,
  getAllPersonas,
  getOnboardingPersonas,
  getPersonaById,
  getPainPointMessaging,
  personaScoringRules,
};
