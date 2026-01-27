/**
 * Fetch all video IDs from curated Epic Games YouTube playlists.
 *
 * Uses YouTube Data API v3 to query playlist items and build a verified video database.
 * Run periodically to keep the content index fresh.
 *
 * Usage:
 *   node scripts/fetch_playlist_videos.js
 *
 * Requires:
 *   YOUTUBE_API_KEY environment variable (or in .env file)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// Load .env if available
try {
  require("dotenv").config();
} catch {
  // dotenv not installed, rely on environment
}

const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  console.error("❌ YOUTUBE_API_KEY not set. Add it to .env or environment.");
  process.exit(1);
}

/**
 * Fetch JSON from a URL
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Fetch all items from a YouTube playlist
 */
async function fetchPlaylistItems(playlistId) {
  const items = [];
  let nextPageToken = null;

  do {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: "50",
      key: API_KEY,
    });
    if (nextPageToken) params.set("pageToken", nextPageToken);

    const url = `https://www.googleapis.com/youtube/v3/playlistItems?${params}`;

    try {
      const data = await fetchJSON(url);
      items.push(...(data.items || []));
      nextPageToken = data.nextPageToken;
    } catch (e) {
      console.error(`  ⚠ Error fetching playlist ${playlistId}: ${e.message}`);
      break;
    }
  } while (nextPageToken);

  return items;
}

/**
 * Process a playlist and return all its videos
 */
async function processPlaylist(playlist) {
  const url = playlist.url;
  const playlistId = url.includes("list=")
    ? url.split("list=")[1].split("&")[0]
    : null;

  if (!playlistId) {
    console.log(`  ⚠ Invalid playlist URL: ${url}`);
    return [];
  }

  console.log(`  Fetching: ${playlist.title} (${playlistId})`);

  const items = await fetchPlaylistItems(playlistId);
  const videos = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const snippet = item.snippet || {};
    const resource = snippet.resourceId || {};
    const videoId = resource.videoId;

    if (!videoId) continue;

    // Get best available thumbnail
    const thumbnails = snippet.thumbnails || {};
    const thumbnailUrl =
      thumbnails.standard?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      "";

    videos.push({
      video_id: videoId,
      title: snippet.title || "",
      description: (snippet.description || "").substring(0, 500),
      thumbnail_url: thumbnailUrl,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      channel: snippet.videoOwnerChannelTitle || "",
      published_at: snippet.publishedAt || "",
      playlist_id: playlistId,
      playlist_title: playlist.title,
      position: idx,
      tags: playlist.tags || [],
    });
  }

  console.log(`    → Found ${videos.length} videos`);
  return videos;
}

/**
 * Main function
 */
async function main() {
  const baseDir = path.join(__dirname, "..");
  const playlistsPath = path.join(baseDir, "content", "curated_playlists.json");

  if (!fs.existsSync(playlistsPath)) {
    console.error(`❌ Curated playlists not found: ${playlistsPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(playlistsPath, "utf-8"));
  const playlists = data.playlists || [];

  console.log(`📋 Processing ${playlists.length} curated playlists...\n`);

  const allVideos = [];
  const playlistStats = [];

  for (const playlist of playlists) {
    const videos = await processPlaylist(playlist);
    allVideos.push(...videos);
    playlistStats.push({
      id: playlist.id,
      title: playlist.title,
      video_count: videos.length,
    });
  }

  // Deduplicate by video_id
  const seenIds = new Set();
  const uniqueVideos = allVideos.filter((v) => {
    if (seenIds.has(v.video_id)) return false;
    seenIds.add(v.video_id);
    return true;
  });

  console.log(
    `\n✅ Total: ${allVideos.length} videos (${uniqueVideos.length} unique)`,
  );

  // Save to content index
  const outputPath = path.join(baseDir, "content", "verified_videos.json");
  const outputData = {
    generated_at: new Date().toISOString(),
    total_videos: uniqueVideos.length,
    playlists_processed: playlists.length,
    playlist_stats: playlistStats,
    videos: uniqueVideos,
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`💾 Saved to: ${outputPath}`);

  // Print summary
  console.log("\n📊 Playlist Summary:");
  playlistStats
    .sort((a, b) => b.video_count - a.video_count)
    .forEach((stat) => {
      console.log(
        `   ${String(stat.video_count).padStart(4)} videos - ${stat.title}`,
      );
    });
}

main().catch(console.error);
