/**
 * PersonalizedMessaging — Generates "Why this matters for YOU" context blocks
 * based on persona pain points and course content.
 *
 * Injects targeted messaging into learning paths so every course card
 * feels personally relevant to the user's industry and workflow.
 */

import { getPersonaById, getPainPointMessaging } from "./PersonaService";

/**
 * Pain-point to course-topic mapping.
 * When a course touches one of these topics AND the active persona has
 * the corresponding pain point, we generate a personalized context block.
 */
const TOPIC_CONTEXT_MAP = {
  // Animator Alex
  animation: {
    animator_alex: "This builds the real-time animation skills you need to stop waiting for offline renders.",
    rigger_regina: "Understanding animation workflows helps you build rigs that animators actually want to use.",
  },
  sequencer: {
    animator_alex: "Sequencer replaces your render queue — preview cinematic shots in real-time.",
    designer_cpg: "Sequencer lets you create product turntables and reveal animations without After Effects.",
  },
  lighting: {
    animator_alex: "Lumen gives you instant lighting feedback — no more bake times.",
    architect_amy: "Real-time lighting is what makes your archviz walkthroughs feel photorealistic to clients.",
    designer_cpg: "Studio lighting presets help you match the product photography your brand team expects.",
    automotive_andy: "Accurate lighting is critical for paint and material evaluation in configurators.",
  },
  materials: {
    designer_cpg: "Material Editor lets you match physical product materials without a photography studio.",
    architect_amy: "PBR materials make your interior renders indistinguishable from photos.",
    automotive_andy: "Automotive paint and trim materials need to match the real car — this shows you how.",
    vfx_victor: "Shader networks in UE5 replace your compositing lookdev pipeline.",
  },
  blueprint: {
    indie_isaac: "Blueprints let you prototype gameplay mechanics without writing a line of C++.",
    logic_liam: "Understanding Blueprint patterns helps you decide when to port critical systems to C++.",
    simulation_sam: "Blueprint scripting is how you wire up interactive training scenarios.",
  },
  niagara: {
    vfx_victor: "Niagara replaces your particle pipeline — real-time VFX iteration at 60fps.",
  },
  "control rig": {
    rigger_regina: "Control Rig is UE5's native rigging system — no more Maya rig export headaches.",
  },
  retarget: {
    rigger_regina: "Retargeting lets you share rigs across characters without rebuilding from scratch.",
    animator_alex: "Retargeting means your mocap data works on any character skeleton.",
  },
  packaging: {
    indie_isaac: "Packaging is the last mile — this ensures your game actually ships.",
    logic_liam: "Build configuration matters for performance profiling on target hardware.",
  },
  profiling: {
    logic_liam: "Profiling separates a working prototype from a shippable product.",
  },
  "digital twin": {
    simulation_sam: "Digital twins are how you mirror real-world training environments in UE5.",
  },
  vehicle: {
    automotive_andy: "Vehicle configurators are UE5's fastest-growing enterprise use case.",
  },
};

/**
 * Generate a personalized "Why this matters for YOU" context block.
 *
 * @param {string} personaId - The detected persona ID
 * @param {object} course - The course object
 * @returns {{ hasContext: boolean, message: string, topic: string, personaName: string }}
 */
export function getContextBlock(personaId, course) {
  if (!personaId || !course) {
    return { hasContext: false, message: "", topic: "", personaName: "" };
  }

  const persona = getPersonaById(personaId);
  if (!persona) {
    return { hasContext: false, message: "", topic: "", personaName: "" };
  }

  const title = (course.title || "").toLowerCase();
  const allTags = [
    ...(course.canonical_tags || []),
    ...(course.ai_tags || []),
    ...(course.gemini_system_tags || []),
    ...(course.transcript_tags || []),
    ...(course.extracted_tags || []),
  ].map((t) => (typeof t === "string" ? t.toLowerCase() : ""));

  const combinedText = `${title} ${allTags.join(" ")}`;

  // Find the first matching topic context
  for (const [topic, personaMessages] of Object.entries(TOPIC_CONTEXT_MAP)) {
    if (combinedText.includes(topic) && personaMessages[personaId]) {
      return {
        hasContext: true,
        message: personaMessages[personaId],
        topic,
        personaName: persona.name || persona.id,
      };
    }
  }

  return { hasContext: false, message: "", topic: "", personaName: persona.name || persona.id };
}

/**
 * Generate a batch of context blocks for a learning path.
 *
 * @param {string} personaId - The detected persona ID
 * @param {Array} courses - Ordered list of courses in the path
 * @returns {Array<{ courseCode: string, hasContext: boolean, message: string, topic: string }>}
 */
export function getPathContextBlocks(personaId, courses = []) {
  if (!personaId || courses.length === 0) return [];

  return courses.map((course) => ({
    courseCode: course.code,
    ...getContextBlock(personaId, course),
  }));
}

/**
 * Get a persona-specific welcome message for the learning path header.
 *
 * @param {string} personaId - The detected persona ID
 * @returns {{ greeting: string, painPoints: string[], icon: string }}
 */
export function getPersonaWelcome(personaId) {
  const persona = getPersonaById(personaId);
  if (!persona) {
    return { greeting: "Here's your personalized learning path:", painPoints: [], icon: "📚" };
  }

  const painPoints = getPainPointMessaging(persona);
  const greetings = {
    animator_alex: "🎬 Your animation-focused path is ready:",
    rigger_regina: "🦴 Your rigging-focused path is ready:",
    indie_isaac: "🎮 Your game dev path is ready:",
    logic_liam: "⚙️ Your systems engineering path is ready:",
    designer_cpg: "🎨 Your product visualization path is ready:",
    architect_amy: "🏛️ Your architectural visualization path is ready:",
    simulation_sam: "🏭 Your simulation & training path is ready:",
    vfx_victor: "✨ Your VFX production path is ready:",
    automotive_andy: "🚗 Your automotive visualization path is ready:",
  };

  return {
    greeting: greetings[personaId] || `Your personalized path for ${persona.name || personaId} is ready:`,
    painPoints,
    icon: persona.icon || "📚",
  };
}

export default { getContextBlock, getPathContextBlocks, getPersonaWelcome };
