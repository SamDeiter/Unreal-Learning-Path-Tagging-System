/**
 * Information Decay Detector for UE5 Tutorial Demand Intelligence
 *
 * Maps UE5 version release dates and their breaking changes, then
 * computes a "decay risk" score for each demand suggestion based on
 * whether existing tutorial content predates relevant breaking changes.
 *
 * Shared between:
 *   - scripts/scrape-demand-intel.js (GitHub Action)
 *   - path-builder/src/services/demandIntelligenceService.js (frontend)
 */

// ── UE5 Breaking Change Map ────────────────────────────────────────
const UE5_BREAKING_CHANGES = {
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
 *
 * @param {string} category    - e.g. "Animation", "AI"
 * @param {string} subtopic    - e.g. "State Trees", "Enhanced Input"
 * @param {Array}  sources     - Source objects, optionally with `date` fields
 * @returns {{ risk: "high"|"medium"|"none", reason: string, breakingVersion: string|null }}
 */
function computeDecayRisk(category, subtopic, sources = []) {
  const searchTerms = [
    category.toLowerCase(),
    subtopic.toLowerCase(),
    ...subtopic.toLowerCase().split(/\s+/),
  ];

  // Find all relevant breaking changes
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

  // Use the LATEST breaking change as the reference point
  relevantChanges.sort((a, b) => b.date - a.date);
  const latestBreaking = relevantChanges[0];

  // Check source dates against the breaking change date
  const sourceDates = sources
    .map((s) => s.date)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()));

  if (sourceDates.length === 0) {
    // No dated sources — if there's a relevant breaking change, medium risk
    return {
      risk: "medium",
      reason: `UE ${latestBreaking.version} changed ${latestBreaking.matchedChanges[0]} — existing content may be outdated`,
      breakingVersion: latestBreaking.version,
    };
  }

  // Check if any sources predate the breaking change
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

  // Some sources are recent — lower risk
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

// ── Demand Index Formula ───────────────────────────────────────────

/**
 * Compute the weighted composite Demand Index for a set of suggestions.
 *
 * Formula tiers (backward-compatible):
 *   4-signal (base):            α=0.30, β=0.30, γ=0.15, δ=0.25
 *   5-signal (+YouTube):        α=0.25, β=0.20, γ=0.10, δ=0.25, ε=0.20
 *   6-signal (+YouTube+Trends): α=0.20, β=0.15, γ=0.10, δ=0.20, ε=0.15, ζ=0.20
 *
 * @param {Array} suggestions - Array of suggestion objects from buildReport
 * @param {Object} [opts] - Weight overrides and signal data
 * @param {Object} [opts.youtubeMetrics] - Per-category YouTube metrics from scrape-youtube-intel
 * @param {Object} [opts.trendsData] - Per-category Google Trends data from scrape-google-trends
 * @returns {Array} Same suggestions with `demandIndex` (0-100) added
 */
function computeDemandIndex(suggestions, opts = {}) {
  if (!suggestions || suggestions.length === 0) return suggestions;

  const ytMetrics = opts.youtubeMetrics || null;
  const trendsData = opts.trendsData || null;
  const hasYouTube = ytMetrics && Object.keys(ytMetrics).length > 0;
  const hasTrends = trendsData && Object.keys(trendsData).length > 0;

  // Pick weights: 6-signal > 5-signal > 4-signal (backward-compatible)
  let alpha, beta, gamma, delta, epsilon, zeta;
  if (hasYouTube && hasTrends) {
    // 6-signal: YouTube + Google Trends
    alpha   = opts.alpha   || 0.20;
    beta    = opts.beta    || 0.15;
    gamma   = opts.gamma   || 0.10;
    delta   = opts.delta   || 0.20;
    epsilon = opts.epsilon || 0.15;
    zeta    = opts.zeta    || 0.20;
  } else if (hasYouTube) {
    // 5-signal: YouTube only
    alpha   = opts.alpha   || 0.25;
    beta    = opts.beta    || 0.20;
    gamma   = opts.gamma   || 0.10;
    delta   = opts.delta   || 0.25;
    epsilon = opts.epsilon || 0.20;
    zeta    = 0;
  } else {
    // 4-signal: base
    alpha   = opts.alpha   || 0.30;
    beta    = opts.beta    || 0.30;
    gamma   = opts.gamma   || 0.15;
    delta   = opts.delta   || 0.25;
    epsilon = 0;
    zeta    = 0;
  }

  // Step 1: Compute raw signal values for each suggestion
  const signals = suggestions.map((s) => {
    const reddit = s.redditEngagement || {};
    const redditScore = Math.min(
      100,
      (reddit.postCount || 0) * 10 +
        (reddit.avgUpvotes || 0) * 2 +
        (reddit.avgComments || 0) * 3
    );

    const sourceScore = Math.min(
      100,
      (s.sourceCount || 0) * 15
    );

    // YouTube signal: avgViews and avgEngagement for the suggestion's category
    let youtubeScore = 0;
    if (hasYouTube) {
      const catMetrics = ytMetrics[s.category] || {};
      const viewSignal = Math.min(100, (catMetrics.avgViews || 0) / 10000 * 100);
      const engSignal = Math.min(100, (catMetrics.avgEngagement || 0) * 1000);
      youtubeScore = viewSignal * 0.7 + engSignal * 0.3;
    }

    // Google Trends signal: scaled search interest (0-100) for the suggestion's category
    let trendsScore = 0;
    if (hasTrends) {
      const catTrends = trendsData[s.category] || {};
      trendsScore = Math.min(100, catTrends.scaledScore || 0);
    }

    return {
      demandScore: s.demandScore || 0,
      redditScore,
      sourceScore,
      gap: s.gap || 0,
      youtubeScore,
      trendsScore,
    };
  });

  // Step 2: Find max values for normalization
  const maxDemand = Math.max(1, ...signals.map((s) => s.demandScore));
  const maxReddit = Math.max(1, ...signals.map((s) => s.redditScore));
  const maxSource = Math.max(1, ...signals.map((s) => s.sourceScore));
  const maxGap = Math.max(1, ...signals.map((s) => s.gap));
  const maxYouTube = Math.max(1, ...signals.map((s) => s.youtubeScore));
  const maxTrends = Math.max(1, ...signals.map((s) => s.trendsScore));

  // Step 3: Compute normalized weighted composite
  for (let i = 0; i < suggestions.length; i++) {
    const s = signals[i];
    const index =
      alpha * ((s.demandScore / maxDemand) * 100) +
      beta * ((s.redditScore / maxReddit) * 100) +
      gamma * ((s.sourceScore / maxSource) * 100) +
      delta * ((s.gap / maxGap) * 100) +
      epsilon * ((s.youtubeScore / maxYouTube) * 100) +
      zeta * ((s.trendsScore / maxTrends) * 100);

    suggestions[i].demandIndex = Math.round(Math.min(100, Math.max(0, index)));

    // Attach YouTube metrics for dashboard display
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

    // Attach Google Trends metrics for dashboard display
    if (hasTrends && trendsData[suggestions[i].category]) {
      const catTrends = trendsData[suggestions[i].category];
      suggestions[i].trendsMetrics = {
        scaledScore: catTrends.scaledScore || 0,
        rawInterest: catTrends.rawInterest || 0,
      };
    }
  }

  return suggestions;
}

// ── Platform Demand Breakdown ─────────────────────────────────────

/**
 * Platform identifiers used in the breakdown.
 */
const PLATFORMS = {
  YOUTUBE: "youtube",
  REDDIT: "reddit",
  EPIC_FORUM: "epicForum",
  DEV_COMMUNITY: "devCommunity",
  COMMUNITY_INDEX: "communityIndex",
  TIKTOK: "tiktok",
  INSTAGRAM: "instagram",
};

const PLATFORM_META = {
  [PLATFORMS.YOUTUBE]:         { icon: "🎬", label: "YouTube",       color: "#FF0000" },
  [PLATFORMS.REDDIT]:          { icon: "💬", label: "Reddit",        color: "#FF4500" },
  [PLATFORMS.EPIC_FORUM]:      { icon: "🏛️", label: "Epic Forums",   color: "#0078D7" },
  [PLATFORMS.DEV_COMMUNITY]:   { icon: "🟣", label: "Dev Community", color: "#7B2FBE" },
  [PLATFORMS.COMMUNITY_INDEX]: { icon: "📊", label: "Curriculum Gap", color: "#10B981" },
  [PLATFORMS.TIKTOK]:          { icon: "🎵", label: "TikTok",        color: "#010101" },
  [PLATFORMS.INSTAGRAM]:       { icon: "📸", label: "Instagram",     color: "#E1306C" },
};

/**
 * Compute per-platform demand scores for a single suggestion.
 *
 * All scores are 0-100. The `dominant` field names the platform with
 * the highest score for this suggestion.
 *
 * @param {Object} suggestion - A suggestion object with sources, redditEngagement, youtubeMetrics, demandScore
 * @returns {{ youtube: number, reddit: number, epicForum: number, devCommunity: number, communityIndex: number, dominant: string, platforms: Object }}
 */
function computePlatformBreakdown(suggestion) {
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

  // Epic Forum: count of epic_forum sources, scaled up
  const epicForumCount = sources.filter(
    (s) => s.type === "epic_forum"
  ).length;
  const epicForum = Math.round(Math.min(100, epicForumCount * 25));

  // Dev Community: count of epic_dev_community sources, scaled up
  const devCommunityCount = sources.filter(
    (s) => s.type === "epic_dev_community"
  ).length;
  const devCommunity = Math.round(Math.min(100, devCommunityCount * 25));

  // TikTok: count of tiktok sources, scaled up
  const tiktokCount = sources.filter(
    (s) => s.type === "tiktok"
  ).length;
  const tiktok = Math.round(Math.min(100, tiktokCount * 25));

  // Instagram: count of instagram sources, scaled up
  const instagramCount = sources.filter(
    (s) => s.type === "instagram"
  ).length;
  const instagram = Math.round(Math.min(100, instagramCount * 25));

  // Community Index: demand score from benchmarks (already 0-100)
  const communityIndex = Math.round(Math.min(100, suggestion.demandScore || 0));

  const scores = { youtube, reddit: redditScore, epicForum, devCommunity, communityIndex, tiktok, instagram };

  // Find dominant platform
  let dominant = PLATFORMS.COMMUNITY_INDEX;
  let maxScore = -1;
  for (const [platform, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      dominant = platform;
    }
  }

  return {
    ...scores,
    dominant,
    platforms: PLATFORM_META,
  };
}

/**
 * Aggregate platform breakdown across all suggestions to get per-platform totals.
 * Returns top topics unique to each platform (high on that platform, low on others).
 *
 * @param {Array} suggestions
 * @returns {Object} Per-platform aggregated data with top unique topics
 */
function aggregatePlatformDemand(suggestions, report = {}) {
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

  // 1. Score from suggestion-level sources
  for (const s of suggestions) {
    const breakdown = s.platformBreakdown || computePlatformBreakdown(s);

    for (const [platform, score] of Object.entries(breakdown)) {
      if (platformTotals[platform] && typeof score === "number") {
        platformTotals[platform].totalScore += score;
        if (score > 0) platformTotals[platform].topicCount++;
      }
    }

    // Distribute topic to all platforms with actual signal (score > 0)
    // Exclude communityIndex — it always has a score from demandScore
    for (const [platform, score] of Object.entries(breakdown)) {
      if (
        platform !== "dominant" &&
        platform !== PLATFORMS.COMMUNITY_INDEX &&
        typeof score === "number" &&
        score > 0 &&
        platformTotals[platform]
      ) {
        platformTotals[platform].uniqueTopics.push({
          topic: s.topic,
          category: s.category,
          score,
        });
      }
    }

    // Always add to communityIndex if it's the dominant platform
    if (breakdown.dominant === PLATFORMS.COMMUNITY_INDEX && platformTotals[PLATFORMS.COMMUNITY_INDEX]) {
      platformTotals[PLATFORMS.COMMUNITY_INDEX].uniqueTopics.push({
        topic: s.topic,
        category: s.category,
        score: breakdown[PLATFORMS.COMMUNITY_INDEX],
      });
    }
  }

  // 2. Derive platform signals from report-level pain points & trending questions
  const painPoints = report.painPointsByCategory || {};
  const platformUrlCounts = {
    [PLATFORMS.YOUTUBE]: 0,
    [PLATFORMS.REDDIT]: 0,
    [PLATFORMS.EPIC_FORUM]: 0,
    [PLATFORMS.DEV_COMMUNITY]: 0,
    [PLATFORMS.TIKTOK]: 0,
    [PLATFORMS.INSTAGRAM]: 0,
  };
  const platformPainTopics = {
    [PLATFORMS.YOUTUBE]: new Set(),
    [PLATFORMS.REDDIT]: new Set(),
    [PLATFORMS.EPIC_FORUM]: new Set(),
    [PLATFORMS.DEV_COMMUNITY]: new Set(),
    [PLATFORMS.TIKTOK]: new Set(),
    [PLATFORMS.INSTAGRAM]: new Set(),
  };

  for (const [category, pps] of Object.entries(painPoints)) {
    for (const pp of pps) {
      const url = (pp.sourceUrl || "").toLowerCase();
      let matchPlatform = null;
      if (url.includes("reddit.com")) matchPlatform = PLATFORMS.REDDIT;
      else if (url.includes("youtube.com") || url.includes("youtu.be"))
        matchPlatform = PLATFORMS.YOUTUBE;
      else if (url.includes("forums.unrealengine.com"))
        matchPlatform = PLATFORMS.EPIC_FORUM;
      else if (url.includes("dev.epicgames.com"))
        matchPlatform = PLATFORMS.DEV_COMMUNITY;
      else if (url.includes("tiktok.com"))
        matchPlatform = PLATFORMS.TIKTOK;
      else if (url.includes("instagram.com"))
        matchPlatform = PLATFORMS.INSTAGRAM;

      if (matchPlatform) {
        platformUrlCounts[matchPlatform]++;
        platformPainTopics[matchPlatform].add(category);
      }
    }
  }

  for (const q of report.trendingQuestions || []) {
    for (const src of q.sources || []) {
      const url = (src.url || "").toLowerCase();
      const type = (src.type || "").toLowerCase();
      let matchPlatform = null;
      if (type === "reddit" || url.includes("reddit.com"))
        matchPlatform = PLATFORMS.REDDIT;
      else if (type === "youtube" || type === "youtube_comments" || url.includes("youtube.com"))
        matchPlatform = PLATFORMS.YOUTUBE;
      else if (type === "epic_forum" || url.includes("forums.unrealengine.com"))
        matchPlatform = PLATFORMS.EPIC_FORUM;
      else if (type === "epic_dev_community" || url.includes("dev.epicgames.com"))
        matchPlatform = PLATFORMS.DEV_COMMUNITY;
      else if (type === "tiktok" || url.includes("tiktok.com"))
        matchPlatform = PLATFORMS.TIKTOK;
      else if (type === "instagram" || url.includes("instagram.com"))
        matchPlatform = PLATFORMS.INSTAGRAM;

      if (matchPlatform) {
        platformUrlCounts[matchPlatform]++;
        if (q.category) platformPainTopics[matchPlatform].add(q.category);
      }
    }
  }

  for (const [platform, count] of Object.entries(platformUrlCounts)) {
    if (count > 0 && platformTotals[platform]) {
      const derivedScore = Math.min(100, count * 15);
      if (platformTotals[platform].totalScore === 0) {
        platformTotals[platform].totalScore = derivedScore;
        platformTotals[platform].topicCount = platformPainTopics[platform].size || count;
      }
      for (const cat of platformPainTopics[platform]) {
        if (!platformTotals[platform].uniqueTopics.find((t) => t.category === cat)) {
          platformTotals[platform].uniqueTopics.push({
            topic: cat,
            category: cat,
            score: derivedScore,
          });
        }
      }
    }
  }

  for (const p of Object.values(platformTotals)) {
    p.avgScore = p.topicCount > 0 ? Math.round(p.totalScore / p.topicCount) : 0;
    p.uniqueTopics.sort((a, b) => b.score - a.score);
    p.uniqueTopics = p.uniqueTopics.slice(0, 3);
  }

  return platformTotals;
}

// ── Exports (CommonJS for Node.js scripts) ────────────────────────
module.exports = {
  UE5_BREAKING_CHANGES,
  computeDecayRisk,
  computeDemandIndex,
  computePlatformBreakdown,
  aggregatePlatformDemand,
  PLATFORMS,
  PLATFORM_META,
};
