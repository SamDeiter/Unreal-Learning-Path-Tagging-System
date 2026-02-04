/**
 * Fetch external insights data (YouTube, RSS feeds)
 * Run via: node scripts/fetch-external-data.js
 * Or via GitHub Actions weekly
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '../path-builder/src/data/external_sources.json');

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
}

main().catch(console.error);
