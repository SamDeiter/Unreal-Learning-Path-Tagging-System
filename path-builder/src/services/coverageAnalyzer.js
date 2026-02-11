/**
 * Coverage Analyzer — Assesses query coverage across all content sources
 * and builds blended learning paths.
 *
 * Three content tiers (highest priority first):
 *   1. First-party videos (video library)
 *   2. Official Epic docs (doc_links.json)
 *   3. Official Epic YouTube (youtube_curated.json)
 */

import { getDocsForTopic, getDocReadingPath } from "./docsSearchService";
import { getResourcesForTopics, getResourcesForTagIds } from "./externalContentService";

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

  // Gather YouTube (matches on topics + tag_ids)
  const youtube = await getResourcesForTopics(topics, { limit: 10 });

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
      const topicMatch = (r.topics || []).some((t) => t.toLowerCase().includes(tLower));
      const tagMatch = (r.tag_ids || []).some((t) => t.toLowerCase().includes(tLower));
      return topicMatch || tagMatch;
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

  // Get YouTube gap-fillers via both topic strings and formal tag_ids
  const ytByTopic = await getResourcesForTopics(topics, { limit: maxYoutube });
  const ytByTag = await getResourcesForTagIds(topics, { limit: maxYoutube });
  // Merge and deduplicate by id
  const seenIds = new Set(ytByTopic.map((r) => r.id));
  const youtube = [...ytByTopic];
  for (const r of ytByTag) {
    if (!seenIds.has(r.id)) {
      youtube.push(r);
      seenIds.add(r.id);
    }
  }

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
    externalEnabled: true,
  };
}

/**
 * Compose a sequenced learning path that interleaves all sources in study order:
 *   1. Prerequisite doc reading (beginner tier, ordered by prerequisites)
 *   2. Core video segments
 *   3. Supplemental doc reading (intermediate/advanced)
 *   4. Official Epic YouTube gap-fillers
 *
 * Returns a flat list of steps, each with a `type` and `step` number.
 *
 * @param {string[]} topics - Topic keywords
 * @param {Array} videoResults - Matched first-party videos
 * @param {Object} [options]
 * @returns {Promise<Array<{step: number, type: string, title: string, url: string, tier?: string, durationMinutes?: number}>>}
 */
export async function composeSequencedPath(topics, videoResults = [], { maxDocs = 5, maxYoutube = 3 } = {}) {
  if (!topics?.length) return [];

  const docs = await getDocReadingPath(topics, { limit: maxDocs });
  const youtube = await getResourcesForTopics(topics, { limit: maxYoutube });

  const steps = [];
  let stepNum = 1;

  // Phase 1: Prerequisite reading (beginner docs)
  const beginnerDocs = docs.filter((d) => d.tier === "beginner");
  for (const doc of beginnerDocs) {
    steps.push({
      step: stepNum++,
      type: "doc",
      phase: "prerequisite",
      title: doc.label || doc.key,
      url: doc.url,
      tier: doc.tier,
      subsystem: doc.subsystem,
      durationMinutes: doc.readTimeMinutes || 10,
      source: "epic_docs",
    });
  }

  // Phase 2: Core first-party video content
  for (const video of videoResults.slice(0, 5)) {
    steps.push({
      step: stepNum++,
      type: "video",
      phase: "core",
      title: video.title,
      url: video.url || "",
      tier: video.tier || "intermediate",
      durationMinutes: video.durationMinutes || 10,
      source: "first_party",
      courseId: video.courseId || video.id,
    });
  }

  // Phase 3: Supplemental reading (intermediate/advanced docs)
  const supplementDocs = docs.filter((d) => d.tier !== "beginner");
  for (const doc of supplementDocs) {
    steps.push({
      step: stepNum++,
      type: "doc",
      phase: "supplemental",
      title: doc.label || doc.key,
      url: doc.url,
      tier: doc.tier,
      subsystem: doc.subsystem,
      durationMinutes: doc.readTimeMinutes || 10,
      source: "epic_docs",
    });
  }

  // Phase 4: YouTube gap-fillers (if enabled)
  for (const yt of youtube) {
    steps.push({
      step: stepNum++,
      type: "youtube",
      phase: "supplemental",
      title: yt.title,
      url: yt.url,
      tier: yt.tier || "intermediate",
      channel: yt.channel,
      durationMinutes: yt.durationMinutes || 15,
      source: "epic_youtube",
    });
  }

  return steps;
}

export default {
  analyzeCoverage,
  buildBlendedPath,
  composeSequencedPath,
};
