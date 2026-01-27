/**
 * Extract Unreal Engine YouTube Playlists WITH Timestamped Learning Segments
 *
 * Extracts videos from YouTube playlists and generates learning segments from:
 * 1. YouTube Chapters (auto)
 * 2. Description timestamp parsing (auto)
 * 3. Full video placeholder (manual)
 *
 * Usage:
 *   node scripts/extract_playlists.js [playlist_urls_or_ids...]
 *
 * Examples:
 *   node scripts/extract_playlists.js PLZlv_N0_O1gZTBUZfQy0Am9ucvXpOV6Ii
 *   node scripts/extract_playlists.js "https://www.youtube.com/playlist?list=PLZlv_N0_O1gZTBUZfQy0Am9ucvXpOV6Ii"
 *
 * Output:
 *   content/playlists.json
 *   content/playlists.csv
 *
 * Requires:
 *   YOUTUBE_API_KEY environment variable
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// Load .env if available
try {
  require("dotenv").config();
} catch {
  // dotenv not installed
}

const API_KEY = process.env.YOUTUBE_API_KEY;
const BASE_URL = "https://www.googleapis.com/youtube/v3";

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch JSON from URL
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message));
            } else {
              resolve(json);
            }
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Parse ISO 8601 duration to seconds
 * e.g., "PT1H2M30S" -> 3750
 */
function parseDuration(iso8601) {
  if (!iso8601) return 0;
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Convert seconds to timecode (HH:MM:SS)
 */
function secondsToTimecode(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Parse timecode (MM:SS or HH:MM:SS) to seconds
 */
function timecodeToSeconds(timecode) {
  const parts = timecode.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

/**
 * Extract playlist ID from URL or return as-is if already an ID
 */
function extractPlaylistId(input) {
  if (input.includes("list=")) {
    const match = input.match(/list=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  // Assume it's already a playlist ID
  return input;
}

// ─────────────────────────────────────────────────────────────────────────────
// YOUTUBE API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get playlist metadata
 */
async function getPlaylistMetadata(playlistId) {
  const params = new URLSearchParams({
    part: "snippet,contentDetails",
    id: playlistId,
    key: API_KEY,
  });
  const url = `${BASE_URL}/playlists?${params}`;
  const data = await fetchJSON(url);
  return data.items?.[0] || null;
}

/**
 * Get all items in a playlist (handles pagination)
 */
async function getPlaylistItems(playlistId) {
  const items = [];
  let nextPageToken = null;

  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      key: API_KEY,
    });
    if (nextPageToken) params.set("pageToken", nextPageToken);

    const url = `${BASE_URL}/playlistItems?${params}`;
    const data = await fetchJSON(url);

    for (const item of data.items || []) {
      items.push(item);
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return items;
}

/**
 * Get video details (duration, description) for multiple videos
 * Videos API supports up to 50 IDs per request
 */
async function getVideoDetails(videoIds) {
  if (videoIds.length === 0) return {};

  const details = {};
  const chunks = [];

  // Split into chunks of 50
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      id: chunk.join(","),
      key: API_KEY,
    });

    const url = `${BASE_URL}/videos?${params}`;
    const data = await fetchJSON(url);

    for (const video of data.items || []) {
      details[video.id] = {
        duration: parseDuration(video.contentDetails?.duration),
        description: video.snippet?.description || "",
        title: video.snippet?.title || "",
      };
    }
  }

  return details;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse timestamps from video description
 * Looks for patterns like:
 *   0:00 Introduction
 *   1:23 Topic One
 *   10:45 Topic Two
 *   1:00:00 Long Topic
 */
function parseTimestampsFromDescription(description, videoDuration) {
  const segments = [];
  const lines = description.split("\n");

  // Pattern: optional leading text, then timestamp, then label
  const timestampPattern =
    /^(?:.*?\s)?(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]?\s*(.+?)$/;

  const timestamps = [];

  for (const line of lines) {
    const match = line.trim().match(timestampPattern);
    if (match) {
      const timecode = match[1];
      const label = match[2].trim();
      const seconds = timecodeToSeconds(timecode);

      // Validate: timestamp must be within video duration
      if (seconds >= 0 && (videoDuration === 0 || seconds < videoDuration)) {
        timestamps.push({ seconds, label, timecode });
      }
    }
  }

  // Sort by timestamp (in case they're out of order)
  timestamps.sort((a, b) => a.seconds - b.seconds);

  // Convert to segments with end times
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const nextTs = timestamps[i + 1];

    const endSeconds = nextTs ? nextTs.seconds : videoDuration || null;

    segments.push({
      segment_index: i,
      label: ts.label,
      start_seconds: ts.seconds,
      end_seconds: endSeconds,
      start_timecode: secondsToTimecode(ts.seconds),
      end_timecode: endSeconds !== null ? secondsToTimecode(endSeconds) : null,
      confidence: "auto",
    });
  }

  return segments;
}

/**
 * Extract segments from a video
 * Priority: 1) Description timestamps, 2) Full video placeholder
 */
function extractSegments(description, videoDuration) {
  // Try parsing timestamps from description
  const segments = parseTimestampsFromDescription(description, videoDuration);

  if (segments.length > 0) {
    return segments;
  }

  // Fallback: full video as single segment
  return [
    {
      segment_index: 0,
      label: "Full video",
      start_seconds: 0,
      end_seconds: videoDuration || null,
      start_timecode: "00:00:00",
      end_timecode: videoDuration ? secondsToTimecode(videoDuration) : null,
      confidence: "manual",
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process a single playlist
 */
async function processPlaylist(playlistId) {
  console.log(`\n📋 Processing playlist: ${playlistId}`);

  // Get playlist metadata
  const metadata = await getPlaylistMetadata(playlistId);
  if (!metadata) {
    console.error(`  ❌ Playlist not found: ${playlistId}`);
    return null;
  }

  const playlistTitle = metadata.snippet?.title || "Unknown";
  const channelTitle = metadata.snippet?.channelTitle || "Unknown";
  const itemCount = metadata.contentDetails?.itemCount || 0;

  console.log(`  📺 ${playlistTitle} (${itemCount} items)`);

  // Get all playlist items
  const playlistItems = await getPlaylistItems(playlistId);
  console.log(`  📥 Fetched ${playlistItems.length} items`);

  // Warn if counts don't match
  if (playlistItems.length !== itemCount) {
    console.warn(
      `  ⚠️ Item count mismatch: API says ${itemCount}, got ${playlistItems.length}`,
    );
  }

  // Get video IDs (filter out private/deleted)
  const videoIds = playlistItems
    .map((item) => item.contentDetails?.videoId)
    .filter(Boolean);

  // Get video details (duration, description)
  const videoDetails = await getVideoDetails(videoIds);

  // Build items array
  const items = [];
  let privateCount = 0;

  for (let i = 0; i < playlistItems.length; i++) {
    const item = playlistItems[i];
    const videoId = item.contentDetails?.videoId;
    const snippet = item.snippet || {};

    // Handle private/deleted videos
    if (
      !videoId ||
      snippet.title === "Private video" ||
      snippet.title === "Deleted video"
    ) {
      privateCount++;
      items.push({
        position: i,
        video_id: null,
        video_title: snippet.title || "Unavailable",
        video_url: null,
        video_url_in_playlist: null,
        published_at: null,
        duration_seconds: 0,
        segments: [],
      });
      continue;
    }

    const details = videoDetails[videoId] || {};
    const duration = details.duration || 0;
    const description = details.description || "";

    // Extract segments
    const segments = extractSegments(description, duration);

    items.push({
      position: i,
      video_id: videoId,
      video_title: snippet.title || details.title || "",
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
      video_url_in_playlist: `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}&index=${i + 1}`,
      published_at: snippet.publishedAt || null,
      duration_seconds: duration,
      segments,
    });
  }

  // Count segments
  const totalSegments = items.reduce(
    (sum, item) => sum + item.segments.length,
    0,
  );
  const autoSegments = items.reduce(
    (sum, item) =>
      sum + item.segments.filter((s) => s.confidence === "auto").length,
    0,
  );
  const manualSegments = totalSegments - autoSegments;

  console.log(
    `  ✅ ${items.length} videos, ${totalSegments} segments (${autoSegments} auto, ${manualSegments} manual)`,
  );
  if (privateCount > 0) {
    console.log(`  🔒 ${privateCount} private/deleted videos`);
  }

  return {
    playlist_id: playlistId,
    playlist_title: playlistTitle,
    playlist_url: `https://www.youtube.com/playlist?list=${playlistId}`,
    channel_title: channelTitle,
    items,
    _stats: {
      total_videos: items.length,
      available_videos: items.length - privateCount,
      private_deleted: privateCount,
      total_segments: totalSegments,
      auto_segments: autoSegments,
      manual_segments: manualSegments,
    },
  };
}

/**
 * Generate CSV from playlist data
 */
function generateCSV(playlists) {
  const headers = [
    "playlist_id",
    "playlist_title",
    "video_position",
    "video_title",
    "video_id",
    "video_url",
    "segment_index",
    "segment_label",
    "start_seconds",
    "end_seconds",
    "confidence",
  ];

  const rows = [headers.join(",")];

  for (const playlist of playlists) {
    for (const video of playlist.items) {
      if (video.segments.length === 0) {
        // Video with no segments (private/deleted)
        rows.push(
          [
            playlist.playlist_id,
            `"${playlist.playlist_title.replace(/"/g, '""')}"`,
            video.position,
            `"${(video.video_title || "").replace(/"/g, '""')}"`,
            video.video_id || "",
            video.video_url || "",
            "",
            "",
            "",
            "",
            "",
          ].join(","),
        );
      } else {
        for (const segment of video.segments) {
          rows.push(
            [
              playlist.playlist_id,
              `"${playlist.playlist_title.replace(/"/g, '""')}"`,
              video.position,
              `"${video.video_title.replace(/"/g, '""')}"`,
              video.video_id,
              video.video_url,
              segment.segment_index,
              `"${segment.label.replace(/"/g, '""')}"`,
              segment.start_seconds,
              segment.end_seconds ?? "",
              segment.confidence,
            ].join(","),
          );
        }
      }
    }
  }

  return rows.join("\n");
}

/**
 * Main function
 */
async function main() {
  if (!API_KEY) {
    console.error("❌ YOUTUBE_API_KEY not set. Add it to .env or environment.");
    process.exit(1);
  }

  // Get playlist IDs from command line args or use defaults
  let playlistInputs = process.argv.slice(2);

  if (playlistInputs.length === 0) {
    // Default test playlists
    playlistInputs = [
      "PLZlv_N0_O1gZTBUZfQy0Am9ucvXpOV6Ii",
      "PLZlv_N0_O1gY_gVCky2InGJ52WuOy6Lqx",
    ];
    console.log("ℹ️  No playlist IDs provided, using test playlists");
  }

  // Extract playlist IDs
  const playlistIds = playlistInputs.map(extractPlaylistId).filter(Boolean);

  console.log(`\n🎬 Extracting ${playlistIds.length} playlist(s)...`);

  const playlists = [];
  let totalVideos = 0;
  let totalSegments = 0;
  let totalAuto = 0;
  let totalManual = 0;
  let totalPrivate = 0;

  for (const playlistId of playlistIds) {
    try {
      const playlist = await processPlaylist(playlistId);
      if (playlist) {
        playlists.push(playlist);
        totalVideos += playlist._stats.total_videos;
        totalSegments += playlist._stats.total_segments;
        totalAuto += playlist._stats.auto_segments;
        totalManual += playlist._stats.manual_segments;
        totalPrivate += playlist._stats.private_deleted;
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${playlistId}: ${error.message}`);
    }
  }

  // Remove internal stats from output
  const outputPlaylists = playlists.map(({ _stats, ...rest }) => rest);

  // Prepare output
  const output = {
    generated_at: new Date().toISOString(),
    summary: {
      playlists_processed: playlists.length,
      total_videos: totalVideos,
      total_segments: totalSegments,
      auto_segments: totalAuto,
      manual_segments: totalManual,
      private_deleted_videos: totalPrivate,
    },
    playlists: outputPlaylists,
  };

  // Write JSON
  const baseDir = path.join(__dirname, "..");
  const jsonPath = path.join(baseDir, "content", "playlists.json");
  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 JSON saved to: ${jsonPath}`);

  // Write CSV
  const csvPath = path.join(baseDir, "content", "playlists.csv");
  fs.writeFileSync(csvPath, generateCSV(outputPlaylists));
  console.log(`💾 CSV saved to: ${csvPath}`);

  // Print summary
  console.log("\n" + "─".repeat(50));
  console.log("📊 EXTRACTION SUMMARY");
  console.log("─".repeat(50));
  console.log(`   Playlists processed: ${playlists.length}`);
  console.log(`   Videos extracted:    ${totalVideos}`);
  console.log(`   Total segments:      ${totalSegments}`);
  console.log(`     - Auto (chapters): ${totalAuto}`);
  console.log(`     - Manual (full):   ${totalManual}`);
  console.log(`   Private/deleted:     ${totalPrivate}`);
  console.log("─".repeat(50));
}

main().catch(console.error);
