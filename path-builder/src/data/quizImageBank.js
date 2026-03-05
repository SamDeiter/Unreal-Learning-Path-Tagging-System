/**
 * quizImageBank.js — Maps diagnostic question concepts to UE5 screenshot images.
 *
 * The diagnostic prompt generates questions with a `concept` field (snake_case).
 * This bank maps those concepts to images so the frontend can display a visual
 * alongside the question. Matching is fuzzy via startsWith.
 *
 * Images live in /public/quiz-images/ and are served as static assets.
 * Uses import.meta.env.BASE_URL to resolve correct path regardless of Vite base config.
 */

// Resolve base path for static assets (handles both dev and production)
const BASE = import.meta.env.BASE_URL || "/";

function img(filename) {
  return `${BASE}quiz-images/${filename}`;
}

export const QUIZ_IMAGE_BANK = {
  // Editor panels & navigation
  editor_panel: {
    image: img("details_panel.png"),
    hint: "Identify this panel",
  },
  details_panel: {
    image: img("details_panel.png"),
    hint: "What panel is shown here?",
  },

  // Content Browser
  content_browser: {
    image: img("content_browser.png"),
    hint: "What tool is shown here?",
  },
  asset_management: {
    image: img("content_browser.png"),
    hint: "Where are assets managed?",
  },

  // Blueprints
  blueprint: {
    image: img("blueprint_event_graph.png"),
    hint: "What graph is this?",
  },
  event_graph: {
    image: img("blueprint_event_graph.png"),
    hint: "What graph is shown?",
  },
  visual_scripting: {
    image: img("blueprint_event_graph.png"),
    hint: "What system is shown?",
  },

  // Casting
  casting: {
    image: img("cast_to_node.png"),
    hint: "What does this node do?",
  },
  cast_to: {
    image: img("cast_to_node.png"),
    hint: "What Blueprint node is this?",
  },

  // Materials
  material: {
    image: img("material_editor.png"),
    hint: "What editor is shown?",
  },
  shader: {
    image: img("material_editor.png"),
    hint: "What does this graph create?",
  },

  // World Outliner
  world_outliner: {
    image: img("world_outliner.png"),
    hint: "What panel lists all actors?",
  },
  scene_hierarchy: {
    image: img("world_outliner.png"),
    hint: "What panel organizes your level?",
  },

  // Viewport modes
  viewport: {
    image: img("viewport_wireframe.png"),
    hint: "What view mode is this?",
  },
  wireframe: {
    image: img("viewport_wireframe.png"),
    hint: "What rendering mode is shown?",
  },

  // Sequencer
  sequencer: {
    image: img("sequencer.png"),
    hint: "What tool creates cinematics?",
  },
  cinematic: {
    image: img("sequencer.png"),
    hint: "What tool is shown?",
  },
  level_sequence: {
    image: img("sequencer.png"),
    hint: "What asset type is this?",
  },

  // Mobility
  mobility: {
    image: img("mobility_setting.png"),
    hint: "What do these options control?",
  },
  actor_mobility: {
    image: img("mobility_setting.png"),
    hint: "What setting is highlighted?",
  },
  static_stationary_movable: {
    image: img("mobility_setting.png"),
    hint: "What do these three options mean?",
  },

  // Collision
  collision: {
    image: img("collision_settings.png"),
    hint: "What does this configure?",
  },
  physics: {
    image: img("collision_settings.png"),
    hint: "What settings are shown?",
  },
};

/**
 * Find a matching image for a diagnostic question concept.
 * Uses startsWith matching so "blueprint_networking" matches "blueprint".
 *
 * @param {string} concept - The concept field from a diagnostic question
 * @returns {{ image: string, hint: string } | null}
 */
export function findQuizImage(concept) {
  if (!concept) return null;

  const normalized = concept.toLowerCase().replace(/\s+/g, "_");

  // Exact match first
  if (QUIZ_IMAGE_BANK[normalized]) {
    return QUIZ_IMAGE_BANK[normalized];
  }

  // Fuzzy: check if concept starts with any bank key, or bank key starts with concept
  for (const [key, value] of Object.entries(QUIZ_IMAGE_BANK)) {
    if (normalized.startsWith(key) || key.startsWith(normalized)) {
      return value;
    }
  }

  return null;
}
