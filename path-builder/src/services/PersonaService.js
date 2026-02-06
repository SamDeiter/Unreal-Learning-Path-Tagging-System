/**
 * PersonaService - Detects user persona from learning goals and selected tags
 * Supports multiple industries: Animation, Architecture, Games, Industrial, VFX, Automotive
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
 * Get a specific persona by ID
 * @param {string} personaId - The persona ID
 * @returns {Object|null} - The persona or null if not found
 */
export function getPersonaById(personaId) {
  return personasData.personas.find((p) => p.id === personaId) || null;
}

/**
 * Get pain point messaging for a persona
 * @param {Object} persona - The persona object
 * @returns {string[]} - Array of messaging strings addressing pain points
 */
export function getPainPointMessaging(persona) {
  if (!persona) return [];

  const messaging = {
    animator_alex: [
      "✨ No more waiting for renders - see results in real-time!",
      "🎬 Your Maya/Blender skills transfer directly",
      "🎭 Focus on the art, not the tech",
    ],
    architect_amy: [
      "🏛️ Photorealistic quality in real-time",
      "📐 Walk clients through designs interactively",
      "🎨 Materials that match your specifications",
    ],
    gamedev_gary: [
      "🎮 Industry-standard for AAA and indie games",
      "⚡ Blueprint visual scripting - no C++ required to start",
      "🌐 Deploy to PC, console, and mobile",
    ],
    simulation_sam: [
      "🔧 Connect real-world data to digital twins",
      "📊 Enterprise-grade accuracy and compliance",
      "🎯 Training simulations that save lives",
    ],
    vfx_victor: [
      "✨ Real-time preview of complex effects",
      "🎬 Integrates with your existing pipeline",
      "🔥 Niagara gives you Houdini-level control",
    ],
    automotive_andy: [
      "🚗 Material accuracy to physical specifications",
      "💡 Studio lighting setups made easy",
      "⚙️ Real-time configurators for showrooms",
    ],
  };

  return messaging[persona.id] || [];
}

export default {
  detectPersona,
  getAllPersonas,
  getPersonaById,
  getPainPointMessaging,
};
