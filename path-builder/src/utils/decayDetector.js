/**
 * Information Decay Detector — ES Module version for React frontend
 *
 * Maps UE5 version release dates and breaking changes, computes
 * "decay risk" and weighted Demand Index for suggestion cards.
 *
 * Mirror of scripts/decayDetector.js (CommonJS).
 */

// ── UE5 Breaking Change Map ────────────────────────────────────────
export const UE5_BREAKING_CHANGES = {
  "5.0": {
    date: "2022-04-05",
    changes: [
      "lumen", "nanite", "world partition", "one file per actor",
      "chaos physics", "mass entity",
    ],
  },
  "5.1": {
    date: "2022-11-15",
    changes: [
      "enhanced input", "pcg", "procedural content generation",
      "virtual shadow maps", "strata",
    ],
  },
  "5.2": {
    date: "2023-05-11",
    changes: [
      "substrate", "procedural content generation framework",
      "iris rendering", "skeletal mesh editor",
    ],
  },
  "5.3": {
    date: "2023-11-16",
    changes: [
      "megalights", "motion design", "mograph",
      "nanite tessellation", "virtual heightfield mesh",
    ],
  },
  "5.4": {
    date: "2024-04-23",
    changes: [
      "state tree", "statetree", "animation blueprint",
      "motion matching", "chooser", "smart object",
    ],
  },
  "5.5": {
    date: "2024-09-05",
    changes: [
      "megalights production", "nanite tessellation production",
      "world partition streaming", "game feature plugin",
      "modular gameplay", "verse",
    ],
  },
};

/**
 * Compute decay risk for a demand suggestion.
 * @param {string} category
 * @param {string} subtopic
 * @param {Array}  sources
 * @returns {{ risk: "high"|"medium"|"none", reason: string, breakingVersion: string|null }}
 */
export function computeDecayRisk(category, subtopic, sources = []) {
  const searchTerms = [
    category.toLowerCase(),
    subtopic.toLowerCase(),
    ...subtopic.toLowerCase().split(/\s+/),
  ];

  const relevantChanges = [];
  for (const [version, info] of Object.entries(UE5_BREAKING_CHANGES)) {
    const matchedChanges = info.changes.filter((change) =>
      searchTerms.some(
        (term) => change.includes(term) || term.includes(change)
      )
    );
    if (matchedChanges.length > 0) {
      relevantChanges.push({
        version,
        date: new Date(info.date),
        matchedChanges,
      });
    }
  }

  if (relevantChanges.length === 0) {
    return { risk: "none", reason: "", breakingVersion: null };
  }

  relevantChanges.sort((a, b) => b.date - a.date);
  const latestBreaking = relevantChanges[0];

  const sourceDates = sources
    .map((s) => s.date)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()));

  if (sourceDates.length === 0) {
    return {
      risk: "medium",
      reason: `UE ${latestBreaking.version} changed ${latestBreaking.matchedChanges[0]} — existing content may be outdated`,
      breakingVersion: latestBreaking.version,
    };
  }

  const outdatedCount = sourceDates.filter(
    (d) => d < latestBreaking.date
  ).length;
  const outdatedRatio = outdatedCount / sourceDates.length;

  if (outdatedRatio >= 0.5) {
    return {
      risk: "high",
      reason: `${Math.round(outdatedRatio * 100)}% of sources predate UE ${latestBreaking.version} (${latestBreaking.matchedChanges[0]})`,
      breakingVersion: latestBreaking.version,
    };
  }

  const sixMonthsAfter = new Date(latestBreaking.date);
  sixMonthsAfter.setMonth(sixMonthsAfter.getMonth() + 6);
  const recentCount = sourceDates.filter((d) => d > sixMonthsAfter).length;

  if (recentCount === 0) {
    return {
      risk: "medium",
      reason: `Sources near UE ${latestBreaking.version} release — may not reflect latest patterns`,
      breakingVersion: latestBreaking.version,
    };
  }

  return { risk: "none", reason: "", breakingVersion: latestBreaking.version };
}

/**
 * Compute weighted composite Demand Index for suggestions.
 *
 * 5-signal when YouTube data available (ε=0.20), else 4-signal.
 *
 * @param {Array} suggestions
 * @param {Object} [opts] - Weight overrides and YouTube data
 * @returns {Array} suggestions with `demandIndex` (0-100) added
 */
export function computeDemandIndex(suggestions, opts = {}) {
  if (!suggestions || suggestions.length === 0) return suggestions;

  const ytMetrics = opts.youtubeMetrics || null;
  const hasYouTube = ytMetrics && Object.keys(ytMetrics).length > 0;

  const alpha = opts.alpha || (hasYouTube ? 0.25 : 0.30);
  const beta = opts.beta || (hasYouTube ? 0.20 : 0.30);
  const gamma = opts.gamma || (hasYouTube ? 0.10 : 0.15);
  const delta = opts.delta || (hasYouTube ? 0.25 : 0.25);
  const epsilon = opts.epsilon || (hasYouTube ? 0.20 : 0);

  const signals = suggestions.map((s) => {
    const reddit = s.redditEngagement || {};
    const redditScore = Math.min(
      100,
      (reddit.postCount || 0) * 10 +
        (reddit.avgUpvotes || 0) * 2 +
        (reddit.avgComments || 0) * 3
    );
    const sourceScore = Math.min(100, (s.sourceCount || 0) * 15);

    let youtubeScore = 0;
    if (hasYouTube) {
      const catMetrics = ytMetrics[s.category] || {};
      const viewSignal = Math.min(100, (catMetrics.avgViews || 0) / 10000 * 100);
      const engSignal = Math.min(100, (catMetrics.avgEngagement || 0) * 1000);
      youtubeScore = viewSignal * 0.7 + engSignal * 0.3;
    }

    return {
      demandScore: s.demandScore || 0,
      redditScore,
      sourceScore,
      gap: s.gap || 0,
      youtubeScore,
    };
  });

  const maxDemand = Math.max(1, ...signals.map((s) => s.demandScore));
  const maxReddit = Math.max(1, ...signals.map((s) => s.redditScore));
  const maxSource = Math.max(1, ...signals.map((s) => s.sourceScore));
  const maxGap = Math.max(1, ...signals.map((s) => s.gap));
  const maxYouTube = Math.max(1, ...signals.map((s) => s.youtubeScore));

  for (let i = 0; i < suggestions.length; i++) {
    const s = signals[i];
    const index =
      alpha * ((s.demandScore / maxDemand) * 100) +
      beta * ((s.redditScore / maxReddit) * 100) +
      gamma * ((s.sourceScore / maxSource) * 100) +
      delta * ((s.gap / maxGap) * 100) +
      epsilon * ((s.youtubeScore / maxYouTube) * 100);

    suggestions[i].demandIndex = Math.round(Math.min(100, Math.max(0, index)));

    if (hasYouTube && ytMetrics[suggestions[i].category]) {
      const catMetrics = ytMetrics[suggestions[i].category];
      suggestions[i].youtubeMetrics = {
        avgViews: catMetrics.avgViews || 0,
        avgEngagement: catMetrics.avgEngagement || 0,
        videoCount: catMetrics.videoCount || 0,
        topVideoTitle: catMetrics.topVideo?.title || "",
        topVideoViews: catMetrics.topVideo?.views || 0,
        topVideoUrl: catMetrics.topVideo?.url || "",
      };
    }
  }

  return suggestions;
}

// ── Platform Demand Breakdown ─────────────────────────────────────

export const PLATFORMS = {
  YOUTUBE: "youtube",
  REDDIT: "reddit",
  EPIC_FORUM: "epicForum",
  DEV_COMMUNITY: "devCommunity",
  COMMUNITY_INDEX: "communityIndex",
};

export const PLATFORM_META = {
  [PLATFORMS.YOUTUBE]:         { icon: "🎬", label: "YouTube",       color: "#FF0000" },
  [PLATFORMS.REDDIT]:          { icon: "💬", label: "Reddit",        color: "#FF4500" },
  [PLATFORMS.EPIC_FORUM]:      { icon: "🏛️", label: "Epic Forums",   color: "#0078D7" },
  [PLATFORMS.DEV_COMMUNITY]:   { icon: "🟣", label: "Dev Community", color: "#7B2FBE" },
  [PLATFORMS.COMMUNITY_INDEX]: { icon: "📊", label: "Curriculum Gap", color: "#10B981" },
};

export function computePlatformBreakdown(suggestion) {
  const sources = suggestion.sources || [];
  const reddit = suggestion.redditEngagement || {};
  const yt = suggestion.youtubeMetrics || {};

  // Count sources by type for fallback scoring
  const redditSourceCount = sources.filter(
    (s) => s.type === "reddit"
  ).length;
  const ytSourceCount = sources.filter(
    (s) => s.type === "youtube_comments" || s.type === "youtube"
  ).length;

  // YouTube: youtubeMetrics if available, otherwise count sources
  const ytViewScore = Math.min(100, (yt.avgViews || 0) / 500);
  const ytEngScore = Math.min(100, (yt.avgEngagement || 0) * 2000);
  const ytMetricScore = Math.round(ytViewScore * 0.7 + ytEngScore * 0.3);
  const ytFallback = Math.round(Math.min(100, ytSourceCount * 25));
  const youtube = Math.max(ytMetricScore, ytFallback);

  // Reddit: redditEngagement if available, otherwise count sources
  const redditFromEngagement = Math.min(
    100,
    (reddit.postCount || 0) * 15 +
      (reddit.avgUpvotes || 0) * 3 +
      (reddit.avgComments || 0) * 5
  );
  const redditFromSources = Math.min(100, redditSourceCount * 25);
  const redditScore = Math.round(Math.max(redditFromEngagement, redditFromSources));

  // Epic Forum: count of epic_forum sources
  const epicForumCount = sources.filter(
    (s) => s.type === "epic_forum"
  ).length;
  const epicForum = Math.round(Math.min(100, epicForumCount * 25));

  // Dev Community: count of epic_dev_community sources
  const devCommunityCount = sources.filter(
    (s) => s.type === "epic_dev_community"
  ).length;
  const devCommunity = Math.round(Math.min(100, devCommunityCount * 25));

  // Community Index: demand score from benchmarks (already 0-100)
  const communityIndex = Math.round(Math.min(100, suggestion.demandScore || 0));

  const scores = { youtube, reddit: redditScore, epicForum, devCommunity, communityIndex };

  let dominant = PLATFORMS.COMMUNITY_INDEX;
  let maxScore = -1;
  for (const [platform, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      dominant = platform;
    }
  }

  return { ...scores, dominant, platforms: PLATFORM_META };
}

export function aggregatePlatformDemand(suggestions) {
  if (!suggestions || suggestions.length === 0) return {};

  const platformTotals = {};
  for (const key of Object.values(PLATFORMS)) {
    platformTotals[key] = {
      ...PLATFORM_META[key],
      totalScore: 0,
      topicCount: 0,
      avgScore: 0,
      uniqueTopics: [],
    };
  }

  for (const s of suggestions) {
    const breakdown = s.platformBreakdown || computePlatformBreakdown(s);

    for (const [platform, score] of Object.entries(breakdown)) {
      if (platformTotals[platform] && typeof score === "number") {
        platformTotals[platform].totalScore += score;
        if (score > 0) platformTotals[platform].topicCount++;
      }
    }

    if (breakdown.dominant && platformTotals[breakdown.dominant]) {
      platformTotals[breakdown.dominant].uniqueTopics.push({
        topic: s.topic,
        category: s.category,
        score: breakdown[breakdown.dominant],
      });
    }
  }

  for (const p of Object.values(platformTotals)) {
    p.avgScore = p.topicCount > 0 ? Math.round(p.totalScore / p.topicCount) : 0;
    p.uniqueTopics.sort((a, b) => b.score - a.score);
    p.uniqueTopics = p.uniqueTopics.slice(0, 3);
  }

  return platformTotals;
}
