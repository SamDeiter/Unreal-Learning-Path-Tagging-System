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
 * Formula:
 *   demandIndex = α × norm(demandScore) + β × norm(redditScore)
 *               + γ × norm(sourceScore) + δ × norm(gap)
 *
 * @param {Array} suggestions - Array of suggestion objects from buildReport
 * @param {{ alpha: number, beta: number, gamma: number, delta: number }} weights
 * @returns {Array} Same suggestions with `demandIndex` (0-100) added
 */
function computeDemandIndex(
  suggestions,
  { alpha = 0.30, beta = 0.30, gamma = 0.15, delta = 0.25 } = {}
) {
  if (!suggestions || suggestions.length === 0) return suggestions;

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

    return {
      demandScore: s.demandScore || 0,
      redditScore,
      sourceScore,
      gap: s.gap || 0,
    };
  });

  // Step 2: Find max values for normalization
  const maxDemand = Math.max(1, ...signals.map((s) => s.demandScore));
  const maxReddit = Math.max(1, ...signals.map((s) => s.redditScore));
  const maxSource = Math.max(1, ...signals.map((s) => s.sourceScore));
  const maxGap = Math.max(1, ...signals.map((s) => s.gap));

  // Step 3: Compute normalized weighted composite
  for (let i = 0; i < suggestions.length; i++) {
    const s = signals[i];
    const index =
      alpha * ((s.demandScore / maxDemand) * 100) +
      beta * ((s.redditScore / maxReddit) * 100) +
      gamma * ((s.sourceScore / maxSource) * 100) +
      delta * ((s.gap / maxGap) * 100);

    suggestions[i].demandIndex = Math.round(Math.min(100, Math.max(0, index)));
  }

  return suggestions;
}

// ── Exports (CommonJS for Node.js scripts) ────────────────────────
module.exports = { UE5_BREAKING_CHANGES, computeDecayRisk, computeDemandIndex };
