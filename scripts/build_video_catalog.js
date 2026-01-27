/**
 * Generate a compact video catalog for Gemini RAG context
 *
 * Reads playlists.json and produces a condensed JSON suitable for
 * inclusion in the Gemini prompt. Tags videos by title keywords.
 *
 * Usage:
 *   node scripts/build_video_catalog.js
 *
 * Output:
 *   content/video_catalog.json (compact, tagged)
 */

const fs = require("fs");
const path = require("path");

// Load .env if available
try {
  require("dotenv").config();
} catch {
  // dotenv not installed
}

const baseDir = path.join(__dirname, "..");
const playlistsPath = path.join(baseDir, "content", "playlists.json");
const catalogPath = path.join(baseDir, "content", "video_catalog.json");

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-TAGGING RULES (Based on Epic's Pedagogical Taxonomy)
// ─────────────────────────────────────────────────────────────────────────────

const TAG_RULES = [
  // ═══════════════════════════════════════════════════════════════════════════
  // RENDERING - Nanite, Lumen, Materials
  // ═══════════════════════════════════════════════════════════════════════════
  { pattern: /nanite/i, tag: "rendering.nanite" },
  {
    pattern: /virtualized\s*geometry|cluster|lod\s*auto/i,
    tag: "rendering.nanite",
  },
  { pattern: /lumen/i, tag: "rendering.lumen" },
  { pattern: /global\s*illumination|gi\b/i, tag: "rendering.lumen" },
  { pattern: /ray\s*trac/i, tag: "rendering.ray-tracing" },
  {
    pattern: /surface\s*cache|mesh\s*distance\s*field/i,
    tag: "rendering.lumen",
  },
  { pattern: /material/i, tag: "rendering.materials" },
  { pattern: /substrate/i, tag: "rendering.materials.substrate" },
  { pattern: /shader/i, tag: "rendering.shaders" },
  { pattern: /texture/i, tag: "rendering.textures" },
  {
    pattern: /lighting|light\b|directional|spotlight|pointlight/i,
    tag: "rendering.lighting",
  },
  {
    pattern: /sky\s*atmosphere|environmental\s*light/i,
    tag: "rendering.lighting",
  },
  { pattern: /emissive/i, tag: "rendering.emissive" },
  { pattern: /post\s*process/i, tag: "rendering.post-process" },

  // ═══════════════════════════════════════════════════════════════════════════
  // WORLD BUILDING - World Partition, PCG, Landscape
  // ═══════════════════════════════════════════════════════════════════════════
  { pattern: /world\s*partition/i, tag: "world.partition" },
  { pattern: /one\s*file\s*per\s*actor|ofpa/i, tag: "world.partition" },
  { pattern: /data\s*layer/i, tag: "world.data-layers" },
  { pattern: /large\s*world|lwc|64[\s-]*bit/i, tag: "world.large-world" },
  { pattern: /pcg|procedural\s*content\s*generation/i, tag: "world.pcg" },
  { pattern: /biome/i, tag: "world.pcg.biomes" },
  { pattern: /landscape/i, tag: "world.landscape" },
  { pattern: /foliage|grass\s*type/i, tag: "world.foliage" },
  { pattern: /terrain/i, tag: "world.terrain" },
  { pattern: /houdini/i, tag: "world.houdini" },
  { pattern: /city\s*sample|matrix\s*awaken/i, tag: "world.city-sample" },
  { pattern: /electric\s*dreams/i, tag: "world.electric-dreams" },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION - Control Rig, Motion Matching, MetaHuman
  // ═══════════════════════════════════════════════════════════════════════════
  { pattern: /control\s*rig/i, tag: "animation.control-rig" },
  { pattern: /fbik|full\s*body\s*ik/i, tag: "animation.control-rig" },
  { pattern: /modular\s*rig/i, tag: "animation.control-rig.modular" },
  { pattern: /motion\s*match/i, tag: "animation.motion-matching" },
  { pattern: /pose\s*search|trajectory/i, tag: "animation.motion-matching" },
  { pattern: /metahuman/i, tag: "animation.metahuman" },
  {
    pattern: /facial\s*capture|live\s*link\s*face/i,
    tag: "animation.metahuman",
  },
  { pattern: /animation|anim\b|skeletal/i, tag: "animation" },
  { pattern: /montage/i, tag: "animation.montages" },
  { pattern: /blend\s*(tree|space)/i, tag: "animation.blending" },
  { pattern: /sequencer/i, tag: "animation.sequencer" },
  { pattern: /cinemat/i, tag: "animation.cinematics" },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIO - MetaSounds, Quartz
  // ═══════════════════════════════════════════════════════════════════════════
  { pattern: /metasound/i, tag: "audio.metasounds" },
  { pattern: /procedural\s*audio|dsp\b|synthesis/i, tag: "audio.metasounds" },
  { pattern: /quartz/i, tag: "audio.quartz" },
  { pattern: /sample[\s-]*accurate|beat\s*sync|rhythm/i, tag: "audio.quartz" },
  { pattern: /audio|sound/i, tag: "audio" },

  // ═══════════════════════════════════════════════════════════════════════════
  // GAMEPLAY - Enhanced Input, GAS, Lyra
  // ═══════════════════════════════════════════════════════════════════════════
  { pattern: /enhanced\s*input/i, tag: "gameplay.enhanced-input" },
  {
    pattern: /input\s*mapping\s*context|input\s*action/i,
    tag: "gameplay.enhanced-input",
  },
  { pattern: /gameplay\s*ability|gas\b/i, tag: "gameplay.gas" },
  { pattern: /lyra/i, tag: "gameplay.lyra" },
  {
    pattern: /modular\s*game\s*feature|game\s*feature\s*plugin/i,
    tag: "gameplay.modular-features",
  },
  { pattern: /game\s*mode|game\s*state/i, tag: "gameplay.framework" },
  { pattern: /player|character|pawn/i, tag: "gameplay.character" },
  { pattern: /camera/i, tag: "gameplay.camera" },
  { pattern: /spawn/i, tag: "gameplay.spawning" },
  { pattern: /pickup|collect/i, tag: "gameplay.pickups" },
  { pattern: /trigger|overlap/i, tag: "gameplay.triggers" },
  { pattern: /stack[\s-]*o[\s-]*bot/i, tag: "gameplay.stack-o-bot" },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLUEPRINTS
  // ═══════════════════════════════════════════════════════════════════════════
  { pattern: /blueprint/i, tag: "blueprint" },
  { pattern: /variable/i, tag: "blueprint.variables" },
  { pattern: /function/i, tag: "blueprint.functions" },
  {
    pattern: /event\s*graph|event\s*tick|begin\s*play/i,
    tag: "blueprint.events",
  },
  { pattern: /cast\s*to|casting/i, tag: "blueprint.casting" },
  { pattern: /interface/i, tag: "blueprint.interfaces" },
  { pattern: /accessed\s*none/i, tag: "blueprint.accessed-none" },

  // ═══════════════════════════════════════════════════════════════════════════
  // UI/UMG
  // ═══════════════════════════════════════════════════════════════════════════
  { pattern: /widget|umg|ui\b|hud/i, tag: "ui.umg" },
  { pattern: /menu/i, tag: "ui.menus" },
  { pattern: /button|slider|text\s*block/i, tag: "ui.widgets" },

  // ═══════════════════════════════════════════════════════════════════════════
  // SPECIALIZED - Virtual Production, Motion Design, AI
  // ═══════════════════════════════════════════════════════════════════════════
  {
    pattern: /virtual\s*production|icvfx|led\s*wall/i,
    tag: "specialized.virtual-production",
  },
  { pattern: /ndisplay/i, tag: "specialized.virtual-production" },
  { pattern: /vcam|virtual\s*camera/i, tag: "specialized.vcam" },
  {
    pattern: /motion\s*design|avalanche|broadcast/i,
    tag: "specialized.motion-design",
  },
  { pattern: /effector|3d\s*text/i, tag: "specialized.motion-design" },
  { pattern: /mass\s*ai|crowd/i, tag: "specialized.mass-ai" },
  { pattern: /zone\s*graph|traffic/i, tag: "specialized.mass-ai" },
  { pattern: /ai\b|behavior\s*tree|blackboard/i, tag: "ai" },
  { pattern: /nav\s*mesh|navigation/i, tag: "ai.navigation" },

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD & PACKAGING
  // ═══════════════════════════════════════════════════════════════════════════
  { pattern: /packag|build|compil/i, tag: "build" },
  { pattern: /cook/i, tag: "build.cooking" },
  { pattern: /deploy/i, tag: "build.deployment" },
  { pattern: /debug|breakpoint|log/i, tag: "debug" },
  { pattern: /error|crash|fix/i, tag: "debug.errors" },
  { pattern: /profile|optimi/i, tag: "performance" },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECT SETUP & ONBOARDING
  // ═══════════════════════════════════════════════════════════════════════════
  { pattern: /project|getting\s*started|first\s*hour/i, tag: "onboarding" },
  { pattern: /install/i, tag: "onboarding.installation" },
  { pattern: /viewport|navigate|editor/i, tag: "onboarding.editor" },
  {
    pattern: /asset|content\s*browser|content\s*drawer/i,
    tag: "onboarding.assets",
  },
  { pattern: /level|save|map/i, tag: "onboarding.levels" },
  { pattern: /component/i, tag: "components" },
  { pattern: /static\s*mesh/i, tag: "components.staticmesh" },

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTIPLAYER & NETWORKING
  // ═══════════════════════════════════════════════════════════════════════════
  { pattern: /multipla|network|replicat/i, tag: "multiplayer" },
  { pattern: /eos|epic\s*online\s*services/i, tag: "multiplayer.eos" },
  { pattern: /matchmak|lobby/i, tag: "multiplayer.matchmaking" },

  // ═══════════════════════════════════════════════════════════════════════════
  // VERSION-SPECIFIC
  // ═══════════════════════════════════════════════════════════════════════════
  { pattern: /5\.0\b/i, tag: "version.5.0" },
  { pattern: /5\.1\b/i, tag: "version.5.1" },
  { pattern: /5\.2\b/i, tag: "version.5.2" },
  { pattern: /5\.3\b/i, tag: "version.5.3" },
  { pattern: /5\.4\b/i, tag: "version.5.4" },
  { pattern: /5\.5\b/i, tag: "version.5.5" },
  { pattern: /5\.6\b/i, tag: "version.5.6" },
  { pattern: /5\.7\b/i, tag: "version.5.7" },
];

/**
 * Generate tags for a video based on title
 */
function generateTags(title, playlistTitle) {
  const tags = new Set();
  const combined = `${title} ${playlistTitle}`;

  for (const rule of TAG_RULES) {
    if (rule.pattern.test(combined)) {
      tags.add(rule.tag);
    }
  }

  // Always add a general tag based on playlist
  if (/first hour/i.test(playlistTitle)) {
    tags.add("beginner");
    tags.add("project.setup");
  }
  if (/2\.5d/i.test(playlistTitle)) {
    tags.add("gameplay");
    tags.add("2.5d");
  }

  return Array.from(tags);
}

/**
 * Build compact catalog entry
 */
function buildCatalogEntry(video, playlist) {
  const tags = generateTags(video.video_title, playlist.playlist_title);

  // Pick best segment or use full video
  const bestSegment = video.segments?.[0] || {
    start_seconds: 0,
    end_seconds: video.duration_seconds,
  };

  return {
    id: video.video_id,
    title: video.video_title,
    url:
      bestSegment.start_seconds > 0
        ? `${video.video_url}&t=${bestSegment.start_seconds}`
        : video.video_url,
    thumbnail: `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`,
    duration: video.duration_seconds,
    playlist: playlist.playlist_title,
    tags,
    // For segment selection
    segments:
      video.segments?.map((s) => ({
        label: s.label,
        start: s.start_seconds,
        end: s.end_seconds,
      })) || [],
  };
}

/**
 * Main function
 */
function main() {
  if (!fs.existsSync(playlistsPath)) {
    console.error(`❌ Playlists not found: ${playlistsPath}`);
    console.error("   Run: node scripts/extract_playlists.js first");
    process.exit(1);
  }

  const playlistsData = JSON.parse(fs.readFileSync(playlistsPath, "utf-8"));
  const catalog = [];
  const tagCounts = {};

  for (const playlist of playlistsData.playlists || []) {
    for (const video of playlist.items || []) {
      if (!video.video_id) continue; // Skip private/deleted

      const entry = buildCatalogEntry(video, playlist);
      catalog.push(entry);

      // Count tags for stats
      for (const tag of entry.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }

  // Sort by tag count (most tagged = most specific)
  catalog.sort((a, b) => b.tags.length - a.tags.length);

  const output = {
    generated_at: new Date().toISOString(),
    total_videos: catalog.length,
    tag_summary: Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count })),
    videos: catalog,
  };

  fs.writeFileSync(catalogPath, JSON.stringify(output, null, 2));

  console.log("✅ Built video catalog for RAG");
  console.log(`   Videos: ${catalog.length}`);
  console.log(`   Unique tags: ${Object.keys(tagCounts).length}`);
  console.log(`\n💾 Saved to: ${catalogPath}`);

  // Print top tags
  console.log("\n📊 Top tags:");
  output.tag_summary.slice(0, 10).forEach((t) => {
    console.log(`   ${String(t.count).padStart(3)} - ${t.tag}`);
  });
}

main();
