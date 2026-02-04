/**
 * Fetch external insights data (YouTube, RSS feeds)
 * Run via: node scripts/fetch-external-data.js
 * Or via GitHub Actions weekly
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '../path-builder/src/data/external_sources.json');
const TAG_HISTORY_PATH = path.join(__dirname, '../path-builder/src/data/tag_history.json');
const VIDEO_LIBRARY_PATH = path.join(__dirname, '../path-builder/src/data/video_library_enriched.json');

// Epic Games RSS feed for UE news
const EPIC_RSS_URL = 'https://www.unrealengine.com/en-US/feed';

// YouTube Data API (optional - needs API key in env)
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const YOUTUBE_TERMS = ['unreal engine 5 tutorial', 'ue5 blueprint'];

async function fetchEpicRSS() {
  console.log('📰 Fetching Epic Games RSS...');
  try {
    const response = await fetch(EPIC_RSS_URL);
    const text = await response.text();
    
    // Simple title extraction
    const titleMatch = text.match(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>/);
    if (titleMatch) {
      return [{
        type: 'epic',
        icon: '🎮',
        title: 'Latest from Epic',
        description: titleMatch[1].substring(0, 120),
        source: 'Epic Games Blog RSS',
        priority: 'medium'
      }];
    }
  } catch (err) {
    console.log('⚠️ Epic RSS failed:', err.message);
  }
  return [];
}

async function fetchYouTube() {
  if (!YOUTUBE_API_KEY) {
    console.log('⏭️ YouTube: Skipped (no API key)');
    return [];
  }
  
  console.log('📺 Fetching YouTube trends...');
  const insights = [];
  
  for (const term of YOUTUBE_TERMS) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(term)}&type=video&order=viewCount&maxResults=3&publishedAfter=${getLastWeekISO()}&key=${YOUTUBE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.items?.length > 0) {
        insights.push({
          type: 'youtube',
          icon: '📺',
          title: `Trending: ${term}`,
          description: `"${data.items[0].snippet.title}" is gaining views.`,
          source: 'YouTube Data API - views this week',
          priority: 'low'
        });
      }
    } catch (err) {
      console.log(`⚠️ YouTube fetch error: ${err.message}`);
    }
  }
  
  return insights;
}

function getLastWeekISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function collectTagSnapshot() {
  console.log('📊 Collecting tag snapshot...');
  
  try {
    // Load video library
    if (!fs.existsSync(VIDEO_LIBRARY_PATH)) {
      console.log('⚠️ Video library not found, skipping tag snapshot');
      return;
    }
    
    const library = JSON.parse(fs.readFileSync(VIDEO_LIBRARY_PATH, 'utf-8'));
    const courses = library.courses || [];
    
    // Count tags
    const tagCounts = {};
    courses.forEach(course => {
      const tags = [
        ...(course.gemini_system_tags || []),
        ...(course.ai_tags || []),
        ...(course.extracted_tags || [])
      ];
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    // Top 15 tags for the snapshot
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .reduce((acc, [tag, count]) => ({ ...acc, [tag]: count }), {});
    
    // Load existing history
    let history = { metadata: { created: new Date().toISOString() }, snapshots: [] };
    if (fs.existsSync(TAG_HISTORY_PATH)) {
      history = JSON.parse(fs.readFileSync(TAG_HISTORY_PATH, 'utf-8'));
    }
    
    // Check if we already have a snapshot this week
    const today = new Date().toISOString().split('T')[0];
    const hasRecentSnapshot = history.snapshots.some(s => s.date === today);
    
    if (!hasRecentSnapshot) {
      history.snapshots.push({
        date: today,
        totalCourses: courses.length,
        tags: topTags
      });
      
      // Keep only last 12 weeks
      if (history.snapshots.length > 12) {
        history.snapshots = history.snapshots.slice(-12);
      }
      
      history.metadata.lastUpdated = new Date().toISOString();
      fs.writeFileSync(TAG_HISTORY_PATH, JSON.stringify(history, null, 2));
      console.log(`✅ Added tag snapshot for ${today}`);
    } else {
      console.log('⏭️ Tag snapshot already exists for today');
    }
  } catch (err) {
    console.log('⚠️ Tag snapshot failed:', err.message);
  }
}

async function main() {
  console.log('🚀 Fetching external insights...\n');
  
  const epicInsights = await fetchEpicRSS();
  const youtubeInsights = await fetchYouTube();
  
  const allInsights = [...epicInsights, ...youtubeInsights];
  
  const output = {
    _meta: {
      lastFetched: new Date().toISOString(),
      sourceCount: {
        epicBlog: epicInsights.length,
        youtube: youtubeInsights.length
      }
    },
    insights: allInsights
  };
  
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\n✅ Wrote ${allInsights.length} insights to external_sources.json`);
  
  // Also collect tag snapshot for historical tracking
  collectTagSnapshot();
}

main().catch(console.error);

