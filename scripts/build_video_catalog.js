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
// AUTO-TAGGING RULES
// ─────────────────────────────────────────────────────────────────────────────

const TAG_RULES = [
  // Blueprints
  { pattern: /blueprint/i, tag: "blueprint" },
  { pattern: /variable/i, tag: "blueprint.variables" },
  { pattern: /function/i, tag: "blueprint.functions" },
  { pattern: /event/i, tag: "blueprint.events" },
  { pattern: /cast/i, tag: "blueprint.casting" },
  { pattern: /interface/i, tag: "blueprint.interfaces" },

  // UI/UMG
  { pattern: /widget|umg|ui|hud/i, tag: "ui.umg" },
  { pattern: /menu/i, tag: "ui.menus" },
  { pattern: /button/i, tag: "ui.widgets" },

  // Animation
  { pattern: /animation|anim\b/i, tag: "animation" },
  { pattern: /skeletal/i, tag: "animation.skeletal" },
  { pattern: /montage/i, tag: "animation.montages" },
  { pattern: /blend/i, tag: "animation.blending" },

  // Materials/Rendering
  { pattern: /material/i, tag: "rendering.materials" },
  { pattern: /shader/i, tag: "rendering.shaders" },
  { pattern: /texture/i, tag: "rendering.textures" },
  { pattern: /lighting|light\b/i, tag: "rendering.lighting" },
  { pattern: /lumen/i, tag: "rendering.lumen" },
  { pattern: /nanite/i, tag: "rendering.nanite" },

  // Landscape/Environment
  { pattern: /landscape/i, tag: "environment.landscape" },
  { pattern: /foliage|grass/i, tag: "environment.foliage" },
  { pattern: /terrain/i, tag: "environment.terrain" },

  // Physics
  { pattern: /physics|collision/i, tag: "physics" },
  { pattern: /rigid body/i, tag: "physics.rigidbody" },

  // Audio
  { pattern: /audio|sound/i, tag: "audio" },

  // Gameplay
  { pattern: /player|character|pawn/i, tag: "gameplay.character" },
  { pattern: /input|controller|enhanced input/i, tag: "gameplay.input" },
  { pattern: /camera/i, tag: "gameplay.camera" },
  { pattern: /game mode|game state/i, tag: "gameplay.framework" },
  { pattern: /spawn/i, tag: "gameplay.spawning" },
  { pattern: /pickup|collect/i, tag: "gameplay.pickups" },
  { pattern: /trigger/i, tag: "gameplay.triggers" },
  { pattern: /overlap/i, tag: "gameplay.collision" },

  // AI
  { pattern: /ai|behavior tree|blackboard/i, tag: "ai" },
  { pattern: /nav mesh|navigation/i, tag: "ai.navigation" },

  // Packaging/Build
  { pattern: /packag|build|compil/i, tag: "build" },
  { pattern: /cook/i, tag: "build.cooking" },
  { pattern: /deploy/i, tag: "build.deployment" },

  // Project Setup
  { pattern: /project|getting started|first hour/i, tag: "project.setup" },
  { pattern: /install/i, tag: "project.installation" },
  { pattern: /viewport|navigate/i, tag: "project.navigation" },
  { pattern: /asset/i, tag: "project.assets" },
  { pattern: /level|save/i, tag: "project.levels" },

  // Components
  { pattern: /component/i, tag: "components" },
  { pattern: /static mesh/i, tag: "components.staticmesh" },
  { pattern: /skeletal mesh/i, tag: "components.skeletalmesh" },
  { pattern: /spotlight|pointlight/i, tag: "components.lights" },

  // Debugging
  { pattern: /debug|breakpoint|log/i, tag: "debug" },
  { pattern: /error|crash|fix/i, tag: "debug.errors" },
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
