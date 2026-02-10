/**
 * Coverage Analyzer — Assesses query coverage across all content sources
 * and builds blended learning paths.
 *
 * Three content tiers (highest priority first):
 *   1. First-party videos (video library)
 *   2. Official Epic docs (doc_links.json)
 *   3. Curated YouTube (youtube_curated.json, third-party)
 */

import { getDocsForTopic, getDocReadingPath } from "./docsSearchService";
import { getResourcesForTopics, isEnabled as isExternalEnabled } from "./externalContentService";

/**
 * Analyze coverage for a set of topics across all content sources.
 *
 * @param {string[]} topics - Topic keywords extracted from the user query
 * @param {Array} videoResults - Videos already matched from the video library
 * @returns {Promise<Object>} Coverage analysis with per-source breakdowns
 */
export async function analyzeCoverage(topics, videoResults = []) {
  if (!topics?.length) {
    return {
      topics: [],
      firstPartyVideos: 0,
      docsArticles: 0,
      youtubeResources: 0,
      coverageScore: 0,
      gaps: [],
    };
  }

  // Gather docs
  const docs = await getDocsForTopic(topics, { limit: 10 });

  // Gather YouTube (respects kill switch)
  const youtube = await getResourcesForTopics(topics, { limit: 5 });

  // Calculate per-topic coverage
  const topicCoverage = {};
  for (const topic of topics) {
    const tLower = topic.toLowerCase();
    const videoHits = videoResults.filter((v) => {
      const tags = (v.tags || []).map((t) => t.toLowerCase());
      const title = (v.title || "").toLowerCase();
      return tags.some((t) => t.includes(tLower)) || title.includes(tLower);
    }).length;

    const docHits = docs.filter((d) => {
      return d.key?.toLowerCase().includes(tLower) ||
             d.subsystem?.toLowerCase() === tLower ||
             d.label?.toLowerCase().includes(tLower);
    }).length;

    const ytHits = youtube.filter((r) => {
      return (r.topics || []).some((t) => t.toLowerCase().includes(tLower));
    }).length;

    const total = videoHits + docHits + ytHits;
    topicCoverage[topic] = {
      firstPartyVideos: videoHits,
      docsArticles: docHits,
      youtubeResources: ytHits,
      total,
      covered: total > 0,
    };
  }

  // Overall coverage score (0–1)
  const coveredTopics = Object.values(topicCoverage).filter((t) => t.covered).length;
  const coverageScore = topics.length > 0 ? coveredTopics / topics.length : 0;

  // Identify gaps
  const gaps = Object.entries(topicCoverage)
    .filter(([, v]) => !v.covered)
    .map(([topic]) => topic);

  return {
    topics,
    topicCoverage,
    firstPartyVideos: videoResults.length,
    docsArticles: docs.length,
    youtubeResources: youtube.length,
    coverageScore,
    gaps,
  };
}

/**
 * Build a blended learning path from all three content sources.
 * Priority: first-party videos > official docs > curated YouTube.
 *
 * @param {string[]} topics - Topic keywords from the user query
 * @param {Array} videoResults - Already-matched first-party videos
 * @param {Object} [options]
 * @param {number} [options.maxDocs] - Max doc links (default 5)
 * @param {number} [options.maxYoutube] - Max YouTube links (default 3)
 * @returns {Promise<{docs: Array, youtube: Array, totalTimeMinutes: number, coverageScore: number}>}
 */
export async function buildBlendedPath(topics, videoResults = [], { maxDocs = 5, maxYoutube = 3 } = {}) {
  if (!topics?.length) {
    return { docs: [], youtube: [], totalTimeMinutes: 0, coverageScore: 0 };
  }

  // Get prerequisite-ordered reading path
  const docs = await getDocReadingPath(topics, { limit: maxDocs });

  // Get YouTube gap-fillers (only if external content enabled)
  const youtube = await getResourcesForTopics(topics, { limit: maxYoutube });

  // Calculate total estimated time
  const videoTime = videoResults.reduce((sum, v) => sum + (v.durationMinutes || 10), 0);
  const docTime = docs.reduce((sum, d) => sum + (d.readTimeMinutes || 10), 0);
  const ytTime = youtube.reduce((sum, y) => sum + (y.durationMinutes || 15), 0);

  // Coverage analysis
  const coverage = await analyzeCoverage(topics, videoResults);

  return {
    docs,
    youtube,
    totalTimeMinutes: videoTime + docTime + ytTime,
    coverageScore: coverage.coverageScore,
    gaps: coverage.gaps,
    externalEnabled: isExternalEnabled(),
  };
}

export default {
  analyzeCoverage,
  buildBlendedPath,
};
