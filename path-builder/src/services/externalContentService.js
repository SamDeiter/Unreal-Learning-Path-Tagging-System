/**
 * External Content Service — Official Epic YouTube integration.
 *
 * Loads curated Epic Games YouTube content from youtube_curated.json.
 * All resources are official Unreal Engine tutorials.
 */

import { devWarn } from "../utils/logger";

// Lazy-loaded
let _ytData = null;

/**
 * Lazily load youtube_curated.json.
 * Returns null gracefully if file is missing.
 */
async function getYouTubeData() {
  if (_ytData !== undefined && _ytData !== null) return _ytData;

  try {
    const mod = await import("../data/youtube_curated.json");
    _ytData = mod.default || mod;
    return _ytData;
  } catch {
    devWarn("[ExternalContent] youtube_curated.json not found — Epic YouTube content unavailable");
    _ytData = { channels: {}, resources: [] };
    return _ytData;
  }
}

/** Tier sort order: beginner → intermediate → advanced */
const TIER_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

/**
 * Get official Epic YouTube resources matching a set of topics.
 *
 * @param {string[]} topics - Topic keywords to match (e.g., ["lumen", "lighting"])
 * @param {Object} [options]
 * @param {string} [options.maxTier] - Max difficulty ("beginner"|"intermediate"|"advanced")
 * @param {number} [options.limit] - Max results (default 5)
 * @returns {Promise<Array<{id, title, url, channelName, tier, durationMinutes, topics, source}>>}
 */
export async function getResourcesForTopics(topics, { maxTier = "advanced", limit = 5 } = {}) {
  if (!topics?.length) return [];

  const data = await getYouTubeData();
  if (!data?.resources?.length) return [];

  const maxTierOrder = TIER_ORDER[maxTier] ?? 2;
  const topicSet = new Set(topics.map((t) => t.toLowerCase()));
  const results = [];

  for (const resource of data.resources) {
    const tierOrder = TIER_ORDER[resource.tier] ?? 1;
    if (tierOrder > maxTierOrder) continue;

    // Score: count topic overlaps
    const resourceTopics = (resource.topics || []).map((t) => t.toLowerCase());
    let score = 0;
    for (const rt of resourceTopics) {
      if (topicSet.has(rt)) score += 5;
      // Partial match
      for (const qt of topicSet) {
        if (rt.includes(qt) || qt.includes(rt)) score += 2;
      }
    }

    if (score > 0) {
      const channel = data.channels?.[resource.channelKey];
      results.push({
        id: resource.id,
        title: resource.title,
        url: resource.url,
        channelName: channel?.name || "Unreal Engine",
        channelTrust: "official",
        tier: resource.tier,
        durationMinutes: resource.durationMinutes,
        topics: resource.topics,
        description: resource.description || "",
        keyTakeaways: resource.keyTakeaways || [],
        chapters: resource.chapters || [],
        source: "epic_youtube",
        _score: score,
      });
    }
  }

  // Detect UE5 content for priority sorting
  const UE5_PATTERN = /\b(ue\s*5|unreal\s*engine\s*5|5\.\d)/i;
  for (const r of results) {
    r._isUE5 = UE5_PATTERN.test(r.title) ||
               (r.topics || []).some((t) => UE5_PATTERN.test(t));
  }

  // Sort: UE5 first, then best match, then beginner first
  results.sort((a, b) => {
    if (a._isUE5 !== b._isUE5) return a._isUE5 ? -1 : 1;
    if (b._score !== a._score) return b._score - a._score;
    return (TIER_ORDER[a.tier] ?? 1) - (TIER_ORDER[b.tier] ?? 1);
  });

  return results.slice(0, limit).map(({ _score, _isUE5, ...rest }) => rest);
}

/**
 * Get all resources grouped by channel (admin view).
 *
 * @returns {Promise<Object<string, {channel: Object, resources: Array}>>}
 */
export async function getAllByChannel() {
  const data = await getYouTubeData();
  if (!data) return {};

  const grouped = {};
  for (const [key, channel] of Object.entries(data.channels || {})) {
    grouped[key] = {
      channel,
      resources: data.resources.filter((r) => r.channelKey === key),
    };
  }
  return grouped;
}

/**
 * Get summary stats for the Epic YouTube content index.
 *
 * @returns {Promise<{totalResources: number, channels: number, byTier: Object}>}
 */
export async function getStats() {
  const data = await getYouTubeData();
  const byTier = {};
  for (const r of data?.resources || []) {
    byTier[r.tier] = (byTier[r.tier] || 0) + 1;
  }

  return {
    totalResources: data?.resources?.length || 0,
    channels: Object.keys(data?.channels || {}).length,
    byTier,
  };
}

export default {
  getResourcesForTopics,
  getAllByChannel,
  getStats,
};
