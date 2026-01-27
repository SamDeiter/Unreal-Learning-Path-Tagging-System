/**
 * Convert playlists.json to content_index.json format
 *
 * Transforms the segment-based playlist extraction output into
 * the content_index.json format expected by the learning path system.
 *
 * Usage:
 *   node scripts/convert_to_content_index.js
 *
 * Input:  content/playlists.json
 * Output: ingestion/content_index.json (merges with existing)
 */

const fs = require("fs");
const path = require("path");

const baseDir = path.join(__dirname, "..");
const playlistsPath = path.join(baseDir, "content", "playlists.json");
const contentIndexPath = path.join(baseDir, "ingestion", "content_index.json");

/**
 * Convert a video segment to content_index entry format
 */
function segmentToContentEntry(video, segment, playlist) {
  const videoId = video.video_id;
  const start = segment.start_seconds;
  const end = segment.end_seconds;

  // Generate content_id in expected format: yt:<video_id>#t=start-end
  const contentId =
    end !== null
      ? `yt:${videoId}#t=${start}-${end}`
      : `yt:${videoId}#t=${start}`;

  // Generate URL with timestamp
  const url = start > 0 ? `${video.video_url}&t=${start}` : video.video_url;

  // Build title: video title + segment label if not "Full video"
  const title =
    segment.label === "Full video"
      ? video.video_title
      : `${video.video_title} - ${segment.label}`;

  // Generate thumbnail URL (YouTube's standard format)
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  // Extract date for freshness
  const publishedDate = video.published_at
    ? video.published_at.split("T")[0]
    : new Date().toISOString().split("T")[0];

  return {
    content_id: contentId,
    content_type: "youtube_clip",
    title,
    url,
    thumbnail_url: thumbnailUrl,
    snippet: `From playlist: ${playlist.playlist_title}`,
    derived_tags: [], // Tags need to be added manually or via tagging system
    engine_versions: ["5.0", "5.1", "5.2", "5.3", "5.4", "5.5"],
    quality: {
      signal_strength: playlist.channel_title === "Unreal Engine" ? 0.95 : 0.8,
      freshness_date: publishedDate,
      source_authority:
        playlist.channel_title === "Unreal Engine"
          ? "official"
          : "verified_creator",
    },
    // Additional metadata for reference
    _source: {
      playlist_id: playlist.playlist_id,
      playlist_title: playlist.playlist_title,
      video_id: videoId,
      segment_index: segment.segment_index,
      duration_seconds: video.duration_seconds,
      segment_confidence: segment.confidence,
    },
  };
}

/**
 * Main function
 */
function main() {
  // Load playlists.json
  if (!fs.existsSync(playlistsPath)) {
    console.error(`❌ Playlists not found: ${playlistsPath}`);
    console.error("   Run: node scripts/extract_playlists.js first");
    process.exit(1);
  }

  const playlistsData = JSON.parse(fs.readFileSync(playlistsPath, "utf-8"));

  // Load existing content_index.json to preserve schema and non-video entries
  let existingIndex = { entries: [] };
  if (fs.existsSync(contentIndexPath)) {
    existingIndex = JSON.parse(fs.readFileSync(contentIndexPath, "utf-8"));
  }

  // Keep doc_section and forum_thread entries, remove old youtube_clip
  const nonVideoEntries = (existingIndex.entries || []).filter(
    (e) => e.content_type !== "youtube_clip",
  );

  // Convert all playlist segments to content entries
  const videoEntries = [];
  let totalVideos = 0;
  let totalSegments = 0;

  for (const playlist of playlistsData.playlists || []) {
    for (const video of playlist.items || []) {
      if (!video.video_id) continue; // Skip private/deleted

      totalVideos++;

      for (const segment of video.segments || []) {
        const entry = segmentToContentEntry(video, segment, playlist);
        videoEntries.push(entry);
        totalSegments++;
      }
    }
  }

  // Merge entries
  const allEntries = [...nonVideoEntries, ...videoEntries];

  // Build output with schema
  const output = {
    $schema: existingIndex.$schema || "http://json-schema.org/draft-07/schema#",
    version: "0.2.0",
    description: "Atomic content references for docs and video slices",
    generated_at: new Date().toISOString(),
    content_schema: existingIndex.content_schema,
    entries: allEntries,
  };

  // Write updated content_index.json
  fs.writeFileSync(contentIndexPath, JSON.stringify(output, null, 2));

  console.log("✅ Converted playlists to content_index format");
  console.log(`   Videos processed: ${totalVideos}`);
  console.log(`   Segments created: ${totalSegments}`);
  console.log(`   Doc entries kept: ${nonVideoEntries.length}`);
  console.log(`   Total entries:    ${allEntries.length}`);
  console.log(`\n💾 Saved to: ${contentIndexPath}`);
}

main();
