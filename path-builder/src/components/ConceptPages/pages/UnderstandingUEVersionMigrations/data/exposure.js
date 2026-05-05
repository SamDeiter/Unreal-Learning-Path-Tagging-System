/**
 * REF_EXPOSURE — for each verified ref, how many videos in our library
 * mention it and the first few video IDs.
 *
 * Generated 2026-05-05 from src/data/engine_ref_mentions_bundle.json. Re-run
 * `python scripts/build_engine_ref_mention_bundle.py` and regenerate this
 * map whenever the curator queue changes — the source of truth is Firestore
 * via the bundle, this is a hand-checked snapshot for fast offline render.
 *
 * videoIds is capped at 8 per ref to keep this file small. The real total
 * lives in videoCount.
 */
export const REF_EXPOSURE = {
  ref_module_metahuman_capture_manager: {
    videoCount: 1,
    videoIds: ["8NaSZvBG22g"],
  },
  ref_workflow_step_legacy_lighting_shader_code: {
    videoCount: 1,
    videoIds: ["8ShMsjapTZI"],
  },
  ref_module_iad_framework: {
    videoCount: 0,
    videoIds: [],
  },
  ref_module_vreditor_module: {
    videoCount: 0,
    videoIds: [],
  },
  ref_workflow_step_legacy_virtual_scouting_tools: {
    videoCount: 3,
    videoIds: [
      "doc_virtual-scouting-legacy-tools_000",
      "doc_virtual-scouting-in-unreal-engine_000",
      "100.11",
    ],
  },
  ref_blueprint_node_transform_vector_absolute_to_local: {
    videoCount: 0,
    videoIds: [],
  },
  ref_workflow_step_sample_rate_option_for_frame_selection: {
    videoCount: 0,
    videoIds: [],
  },
  ref_class_bodyfitoptions: {
    videoCount: 0,
    videoIds: [],
  },
  ref_blueprint_node_get_pixel_density: {
    videoCount: 4,
    videoIds: [
      "CFSjV7fBS9g",
      "dw9T_UH7IXs",
      "M1J25jJ79U8",
      "w-siBR9Kt2M",
    ],
  },
  ref_workflow_step_unrealstats: {
    videoCount: 14,
    videoIds: [
      "doc_the-media-plate-actor-in-unreal-engine_009",
      "doc_introduction-to-performance-profiling-and-configuration-in-unreal-engine_004",
      "doc_stat-commands-in-unreal-engine_000",
      "doc_stat-commands-in-unreal-engine_001",
      "doc_stat-commands-in-unreal-engine_002",
      "doc_stat-commands-in-unreal-engine_003",
      "doc_optimization-and-development-best-practices-for-mobile-projects-in-unreal-engine_000",
      "doc_optimization-and-development-best-practices-for-mobile-projects-in-unreal-engine_001",
    ],
  },
};

/** Total unique videos affected by any verified ref. */
export const TOTAL_AFFECTED_VIDEOS = 23;

/**
 * Given a doc_-prefixed or YouTube video ID, return a readable label.
 * Doc-pipeline IDs encode the source slug, so we can derive a title;
 * YouTube IDs we just leave as-is until we wire up live lookup.
 */
export function formatVideoLabel(videoId) {
  if (!videoId) return "";
  if (videoId.startsWith("doc_")) {
    // doc_the-media-plate-actor-in-unreal-engine_009 -> "The Media Plate Actor In Unreal Engine (#009)"
    const trimmed = videoId.slice(4);
    const m = trimmed.match(/^(.*)_(\d{3,})$/);
    const slug = m ? m[1] : trimmed;
    const idx = m ? m[2] : null;
    const words = slug
      .split("-")
      .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
    return idx ? `${words} (#${idx})` : words;
  }
  // YouTube ID — short opaque string
  return `YouTube · ${videoId}`;
}
