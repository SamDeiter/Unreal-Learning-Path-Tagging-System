/**
 * scrape-youtube-intel.js — YouTube Tutorial Demand Scraper
 *
 * Scrapes top UE5 tutorial videos from YouTube Data API v3 to feed
 * real viewership/engagement data into the Demand Index formula.
 *
 * Architecture:
 *   1. Load category taxonomy from demand_benchmarks.json
 *   2. For each category, search.list "UE5 {category} tutorial" (top 25 by views)
 *   3. Batch videos.list to get statistics (views, likes, comments)
 *   4. Compute engagement ratio and detect breakout videos (10× channel median)
 *   5. Write to Firestore: demand_intel/youtube_metrics
 *
 * Quota budget (10,000 units/day default):
 *   - 18 categories × 1 search.list = 1,800 units
 *   - ~450 videos ÷ 50 per batch = 9 videos.list = 9 units
 *   - Total: ~1,809 units/day (18% of quota)
 *
 * Required env vars:
 *   YOUTUBE_API_KEY           — YouTube Data API v3 key
 *   FIREBASE_SERVICE_ACCOUNT  — Base64-encoded Firebase service account JSON
 *
 * Usage:
 *   node scripts/scrape-youtube-intel.js
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// ── Paths ──────────────────────────────────────────────────────────
const BENCHMARKS_PATH = path.join(
  __dirname,
  "../path-builder/src/data/demand_benchmarks.json"
);

// ── Config ─────────────────────────────────────────────────────────
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const FIREBASE_SA_B64 = process.env.FIREBASE_SERVICE_ACCOUNT;

const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YT_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

const MAX_RESULTS_PER_CATEGORY = 25;
const VIDEO_BATCH_SIZE = 50; // Max IDs per videos.list call
const RATE_LIMIT_DELAY_MS = 500;
const BREAKOUT_MULTIPLIER = 10; // 10× median = breakout

// ── Firebase Init ──────────────────────────────────────────────────

function initFirestore() {
  if (!FIREBASE_SA_B64) {
    console.warn("⚠️  FIREBASE_SERVICE_ACCOUNT not set — will skip Firestore write");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(
      Buffer.from(FIREBASE_SA_B64, "base64").toString("utf-8")
    );

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    return admin.firestore();
  } catch (err) {
    console.error(`❌ Firebase init failed: ${err.message}`);
    return null;
  }
}

// ── YouTube API Helpers ────────────────────────────────────────────

/**
 * Search YouTube for UE5 tutorial videos in a category.
 * Cost: 100 quota units per call.
 */
async function searchCategory(category) {
  const query = `"Unreal Engine 5" ${category} tutorial`;
  const url = new URL(YT_SEARCH_URL);
  url.searchParams.set("key", YOUTUBE_API_KEY);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", query);
  url.searchParams.set("order", "viewCount");
  url.searchParams.set("maxResults", String(MAX_RESULTS_PER_CATEGORY));
  url.searchParams.set("relevanceLanguage", "en");
  url.searchParams.set("videoDuration", "medium"); // 4-20 min (tutorial length)

  // Filter out competitor engines from results
  const COMPETITOR_KEYWORDS = /\b(unity|godot|blender|cryengine|source\s*2)\b/i;

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.text();
      console.error(`  ❌ Search failed for "${category}": ${res.status} ${body.slice(0, 200)}`);
      return [];
    }
    const data = await res.json();
    return (data.items || [])
      .filter((item) => !COMPETITOR_KEYWORDS.test(item.snippet?.title || ""))
      .map((item) => ({
        videoId: item.id?.videoId,
        title: item.snippet?.title,
        channelId: item.snippet?.channelId,
        channelTitle: item.snippet?.channelTitle,
        publishedAt: item.snippet?.publishedAt,
        category,
      }));
  } catch (err) {
    console.error(`  ❌ Search error for "${category}": ${err.message}`);
    return [];
  }
}

/**
 * Batch-fetch video statistics and content details.
 * Cost: 1 quota unit per call (up to 50 IDs per call).
 */
async function fetchVideoStats(videoIds) {
  const allStats = {};

  for (let i = 0; i < videoIds.length; i += VIDEO_BATCH_SIZE) {
    const batch = videoIds.slice(i, i + VIDEO_BATCH_SIZE);
    const url = new URL(YT_VIDEOS_URL);
    url.searchParams.set("key", YOUTUBE_API_KEY);
    url.searchParams.set("part", "statistics,contentDetails");
    url.searchParams.set("id", batch.join(","));

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        console.error(`  ❌ videos.list failed: ${res.status}`);
        continue;
      }
      const data = await res.json();
      for (const item of data.items || []) {
        const stats = item.statistics || {};
        const duration = item.contentDetails?.duration || "";

        allStats[item.id] = {
          viewCount: parseInt(stats.viewCount || "0", 10),
          likeCount: parseInt(stats.likeCount || "0", 10),
          commentCount: parseInt(stats.commentCount || "0", 10),
          duration,
          durationSeconds: parseDuration(duration),
        };
      }
    } catch (err) {
      console.error(`  ❌ videos.list error: ${err.message}`);
    }

    // Brief pause between batches
    if (i + VIDEO_BATCH_SIZE < videoIds.length) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  return allStats;
}

/**
 * Parse ISO 8601 duration (PT1H2M3S) to seconds.
 */
function parseDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) +
         (parseInt(match[2] || "0") * 60) +
         (parseInt(match[3] || "0"));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Analysis ───────────────────────────────────────────────────────

/**
 * Compute engagement ratio for a video.
 */
function engagementRatio(stats) {
  if (!stats || stats.viewCount === 0) return 0;
  return (stats.likeCount + stats.commentCount) / stats.viewCount;
}

/**
 * Detect breakout videos — views > BREAKOUT_MULTIPLIER × channel median.
 */
function detectBreakouts(videos, statsMap) {
  // Group by channel
  const channelVideos = {};
  for (const v of videos) {
    if (!v.videoId || !statsMap[v.videoId]) continue;
    const ch = v.channelId || "unknown";
    if (!channelVideos[ch]) channelVideos[ch] = [];
    channelVideos[ch].push({ ...v, stats: statsMap[v.videoId] });
  }

  const breakouts = [];

  for (const [, vids] of Object.entries(channelVideos)) {
    if (vids.length < 2) continue; // Need at least 2 videos to compare

    const views = vids.map((v) => v.stats.viewCount).sort((a, b) => a - b);
    const median = views[Math.floor(views.length / 2)];
    if (median === 0) continue;

    for (const v of vids) {
      if (v.stats.viewCount >= median * BREAKOUT_MULTIPLIER) {
        breakouts.push({
          videoId: v.videoId,
          title: v.title,
          category: v.category,
          channelTitle: v.channelTitle,
          views: v.stats.viewCount,
          channelMedian: median,
          multiplier: Math.round(v.stats.viewCount / median),
          engagement: engagementRatio(v.stats),
        });
      }
    }
  }

  return breakouts.sort((a, b) => b.multiplier - a.multiplier);
}

/**
 * Aggregate per-category YouTube metrics.
 */
function aggregateByCategory(videos, statsMap) {
  const categoryMetrics = {};

  for (const v of videos) {
    if (!v.videoId || !statsMap[v.videoId]) continue;
    const cat = v.category;
    if (!categoryMetrics[cat]) {
      categoryMetrics[cat] = {
        category: cat,
        videoCount: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        avgViews: 0,
        avgEngagement: 0,
        topVideo: null,
        videos: [],
      };
    }

    const stats = statsMap[v.videoId];
    const m = categoryMetrics[cat];
    m.videoCount++;
    m.totalViews += stats.viewCount;
    m.totalLikes += stats.likeCount;
    m.totalComments += stats.commentCount;

    const videoEntry = {
      videoId: v.videoId,
      title: v.title,
      channelTitle: v.channelTitle,
      publishedAt: v.publishedAt,
      views: stats.viewCount,
      likes: stats.likeCount,
      comments: stats.commentCount,
      engagement: engagementRatio(stats),
      durationSeconds: stats.durationSeconds,
      url: `https://youtube.com/watch?v=${v.videoId}`,
    };

    m.videos.push(videoEntry);

    // Track top video by views
    if (!m.topVideo || stats.viewCount > m.topVideo.views) {
      m.topVideo = videoEntry;
    }
  }

  // Compute averages
  for (const m of Object.values(categoryMetrics)) {
    if (m.videoCount > 0) {
      m.avgViews = Math.round(m.totalViews / m.videoCount);
      m.avgEngagement = m.videos.reduce((sum, v) => sum + v.engagement, 0) / m.videoCount;
      m.avgEngagement = Math.round(m.avgEngagement * 10000) / 10000; // 4 decimals
    }
    // Sort videos by views (descending) and keep top 10
    m.videos.sort((a, b) => b.views - a.views);
    m.videos = m.videos.slice(0, 10);
  }

  return categoryMetrics;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("🎬 YouTube Tutorial Demand Scraper");
  console.log("═".repeat(50));

  if (!YOUTUBE_API_KEY) {
    console.error("❌ YOUTUBE_API_KEY not set. Get one from https://console.cloud.google.com");
    process.exit(1);
  }

  const startTime = Date.now();

  // Load categories from demand benchmarks
  const benchmarks = JSON.parse(fs.readFileSync(BENCHMARKS_PATH, "utf-8"));
  const categories = Object.keys(benchmarks.subtopics || {});
  console.log(`\n📋 ${categories.length} categories to search\n`);

  // ── Step 1: Search for videos per category ────────────────────
  console.log("🔍 Step 1: Searching YouTube for UE5 tutorials...");
  let allVideos = [];
  let quotaUsed = 0;

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    process.stdout.write(`  [${i + 1}/${categories.length}] ${cat}... `);

    const videos = await searchCategory(cat);
    allVideos = allVideos.concat(videos);
    quotaUsed += 100; // search.list cost

    console.log(`${videos.length} videos`);

    // Rate limit between searches
    if (i < categories.length - 1) {
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  }

  // Deduplicate by videoId
  const uniqueMap = new Map();
  for (const v of allVideos) {
    if (v.videoId && !uniqueMap.has(v.videoId)) {
      uniqueMap.set(v.videoId, v);
    }
  }
  const uniqueVideos = Array.from(uniqueMap.values());
  console.log(`\n  ✅ ${uniqueVideos.length} unique videos found (${allVideos.length} total incl. duplicates)\n`);

  // ── Step 2: Fetch video statistics ────────────────────────────
  console.log("📊 Step 2: Fetching video statistics...");
  const videoIds = uniqueVideos.map((v) => v.videoId).filter(Boolean);
  const statsMap = await fetchVideoStats(videoIds);
  const batchCount = Math.ceil(videoIds.length / VIDEO_BATCH_SIZE);
  quotaUsed += batchCount; // videos.list cost = 1 per batch
  console.log(`  ✅ Stats fetched for ${Object.keys(statsMap).length} videos (${batchCount} batch calls)\n`);

  // ── Step 3: Analyze ───────────────────────────────────────────
  console.log("📈 Step 3: Analyzing metrics...");

  // Per-category aggregation
  const categoryMetrics = aggregateByCategory(allVideos, statsMap);

  // Breakout detection
  const breakouts = detectBreakouts(allVideos, statsMap);
  console.log(`  🚀 ${breakouts.length} breakout videos detected`);

  // Global stats
  const allViews = Object.values(statsMap).map((s) => s.viewCount);
  const totalViews = allViews.reduce((a, b) => a + b, 0);
  const avgViews = allViews.length > 0 ? Math.round(totalViews / allViews.length) : 0;

  // ── Build report ──────────────────────────────────────────────
  const report = {
    generatedAt: new Date().toISOString(),
    generationTimeMs: Date.now() - startTime,
    quotaUsed,
    quotaRemaining: 10000 - quotaUsed,
    summary: {
      categoriesSearched: categories.length,
      uniqueVideos: uniqueVideos.length,
      totalViews,
      avgViewsPerVideo: avgViews,
      breakoutCount: breakouts.length,
    },
    categoryMetrics,
    breakouts: breakouts.slice(0, 20), // Top 20 breakouts
  };

  console.log("\n📋 Summary:");
  console.log(`   Categories searched: ${categories.length}`);
  console.log(`   Unique videos: ${uniqueVideos.length}`);
  console.log(`   Total views: ${totalViews.toLocaleString()}`);
  console.log(`   Avg views/video: ${avgViews.toLocaleString()}`);
  console.log(`   Breakout videos: ${breakouts.length}`);
  console.log(`   Quota used: ${quotaUsed}/${10000}`);
  console.log(`   Time: ${report.generationTimeMs}ms`);

  // ── Write to Firestore ────────────────────────────────────────
  const db = initFirestore();
  if (db) {
    console.log("\n🔥 Writing to Firestore...");
    const today = new Date().toISOString().split("T")[0];

    try {
      // Write latest YouTube metrics (overwrite)
      await db.doc("demand_intel/youtube_metrics").set(report);
      console.log("  ✅ demand_intel/youtube_metrics updated");

      // Write historical snapshot
      await db.doc(`demand_intel/youtube_history_${today}`).set({
        date: today,
        generatedAt: report.generatedAt,
        quotaUsed,
        summary: report.summary,
        // Per-category summary (no video arrays to save storage)
        categories: Object.fromEntries(
          Object.entries(categoryMetrics).map(([cat, m]) => [cat, {
            videoCount: m.videoCount,
            totalViews: m.totalViews,
            avgViews: m.avgViews,
            avgEngagement: m.avgEngagement,
            topVideoTitle: m.topVideo?.title || "",
            topVideoViews: m.topVideo?.views || 0,
          }])
        ),
        breakoutCount: breakouts.length,
      });
      console.log(`  ✅ demand_intel/youtube_history_${today} created`);
    } catch (err) {
      console.error(`  ❌ Firestore write failed: ${err.message}`);
    }
  } else {
    console.log("\n⏭️  Skipping Firestore write (no service account)");
    const outputPath = path.join(__dirname, "../youtube_intel_report.json");
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`  📄 Saved report to ${outputPath}`);
  }

  console.log(`\n🏁 Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
