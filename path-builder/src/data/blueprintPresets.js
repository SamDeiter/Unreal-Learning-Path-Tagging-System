/**
 * blueprintPresets.js — Maps UE5 concepts to pre-built Blueprint graph presets
 * in the UE5LMSBlueprint editor.
 *
 * Each key is a concept keyword (lowercase) and the value is the preset graph name.
 * The full URL is constructed as: BLUEPRINT_EDITOR_BASE/?graph={presetName}
 *
 * These presets are READ-ONLY visual explainers — they show how nodes connect,
 * not step-by-step tutorials. Complementary to the in-editor guided tutorials.
 */

/** Base URL for the deployed UE5 Blueprint Editor */
export const BLUEPRINT_EDITOR_BASE = "https://samdeiter.github.io/UE5LMSBlueprint";

/**
 * Concept-to-preset mapping.
 * Keys are lowercase phrases that appear in step titles/summaries.
 * Values are preset graph file names (without .json extension).
 */
export const BLUEPRINT_PRESETS = {
  // ── Player & Pawn ────────────────────────────────────────────────
  "player controller": "player_controller_possess",
  possess: "player_controller_possess",
  pawn: "player_controller_possess",
  "character movement": "character_movement",

  // ── Asset Import & Setup ─────────────────────────────────────────
  "static mesh": "static_mesh_import",
  import: "static_mesh_import",
  fbx: "static_mesh_import",

  // ── Blueprint Basics ─────────────────────────────────────────────
  "blueprint actor": "blueprint_actor",
  "event beginplay": "blueprint_actor",
  "begin play": "blueprint_actor",
  "add component": "blueprint_actor",

  // ── Collision & Physics ──────────────────────────────────────────
  collision: "collision_setup",
  overlap: "collision_setup",
  "hit event": "collision_setup",
  "apply damage": "collision_setup",

  // ── Materials ────────────────────────────────────────────────────
  material: "material_basics",
  texture: "material_basics",
  "base color": "material_basics",
  "normal map": "material_basics",

  // ── Animation ────────────────────────────────────────────────────
  "anim blueprint": "anim_blueprint",
  "animation blueprint": "anim_blueprint",
  "state machine": "anim_blueprint",
  montage: "anim_montage",

  // ── AI ───────────────────────────────────────────────────────────
  "behavior tree": "behavior_tree",
  blackboard: "behavior_tree",
  "ai controller": "behavior_tree",

  // ── UI / UMG ─────────────────────────────────────────────────────
  widget: "umg_widget",
  umg: "umg_widget",
  hud: "umg_widget",

  // ── Niagara ──────────────────────────────────────────────────────
  niagara: "niagara_system",
  particle: "niagara_system",
  vfx: "niagara_system",

  // ── Gameplay ─────────────────────────────────────────────────────
  "game mode": "game_mode",
  "game state": "game_mode",
  "player state": "game_mode",
};

/**
 * Find a matching Blueprint preset for a given step.
 * Checks title and summary for keyword matches.
 *
 * @param {Object} step - A path step object { segment, category, summary }
 * @returns {string|null} Full URL to the Blueprint editor preset, or null
 */
export function getBlueprintUrl(step) {
  if (!step?.segment) return null;

  const searchText = [step.segment.title || "", step.summary || "", step.segment.text || ""]
    .join(" ")
    .toLowerCase();

  // Check longest phrases first to avoid partial matches
  const sortedKeys = Object.keys(BLUEPRINT_PRESETS).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (searchText.includes(key)) {
      const preset = BLUEPRINT_PRESETS[key];
      return `${BLUEPRINT_EDITOR_BASE}/?graph=${encodeURIComponent(preset)}`;
    }
  }

  return null;
}
