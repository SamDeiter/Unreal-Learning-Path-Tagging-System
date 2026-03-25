import { describe, it, expect } from "vitest";
import {
  computeDecayRisk,
  computeDemandIndex,
  computePlatformBreakdown,
  UE5_BREAKING_CHANGES,
} from "../utils/decayDetector";

// ── Helpers ────────────────────────────────────────────────────────

/** Build a minimal suggestion object for testing. */
function makeSuggestion(overrides = {}) {
  return {
    topic: "State Trees",
    category: "AI",
    demandScore: 75,
    gap: 40,
    sourceCount: 3,
    redditEngagement: { postCount: 5, avgUpvotes: 20, avgComments: 8 },
    sources: [],
    ...overrides,
  };
}

/** Build a batch of diverse suggestions for normalization tests. */
function makeBatch() {
  return [
    makeSuggestion({ category: "AI", demandScore: 90, gap: 60 }),
    makeSuggestion({
      category: "Blueprints",
      topic: "Blueprint Interfaces",
      demandScore: 50,
      gap: 20,
      redditEngagement: { postCount: 2, avgUpvotes: 10, avgComments: 3 },
    }),
    makeSuggestion({
      category: "Rendering",
      topic: "Lumen",
      demandScore: 70,
      gap: 45,
      sourceCount: 5,
      redditEngagement: { postCount: 8, avgUpvotes: 30, avgComments: 12 },
    }),
  ];
}

// ── computeDecayRisk ───────────────────────────────────────────────

describe("computeDecayRisk", () => {
  it("returns 'none' when subtopic has no matching breaking changes", () => {
    const result = computeDecayRisk("Audio", "MetaSounds", []);
    expect(result.risk).toBe("none");
    expect(result.breakingVersion).toBeNull();
  });

  it("returns 'medium' when breaking change exists but sources have no dates", () => {
    const result = computeDecayRisk("AI", "State Trees", [
      { type: "reddit", url: "https://reddit.com/r/unrealengine" },
    ]);
    expect(result.risk).toBe("medium");
    expect(result.breakingVersion).toBe("5.4");
    expect(result.reason).toContain("state tree");
  });

  it("returns 'high' when >50% of sources predate the breaking change", () => {
    const result = computeDecayRisk("AI", "State Trees", [
      { date: "2023-01-01" }, // Before UE 5.4 (2024-04-23)
      { date: "2023-06-01" }, // Before UE 5.4
      { date: "2024-09-01" }, // After UE 5.4
    ]);
    expect(result.risk).toBe("high");
    expect(result.breakingVersion).toBe("5.4");
    expect(result.reason).toContain("67%");
  });

  it("returns 'none' when sources are well after the breaking change", () => {
    const result = computeDecayRisk("AI", "State Trees", [
      { date: "2025-01-01" }, // Well after UE 5.4 + 6 months
      { date: "2025-03-01" },
    ]);
    expect(result.risk).toBe("none");
    expect(result.breakingVersion).toBe("5.4");
  });

  it("returns 'medium' when sources are near the breaking release but not 6+ months after", () => {
    const result = computeDecayRisk("AI", "State Trees", [
      { date: "2024-05-01" }, // Just after UE 5.4 (2024-04-23), within 6 months
      { date: "2024-06-01" },
    ]);
    expect(result.risk).toBe("medium");
    expect(result.reason).toContain("may not reflect latest patterns");
  });

  it("uses the LATEST breaking change version when multiple match", () => {
    // "nanite" matches 5.0, "nanite tessellation" matches 5.3 + 5.5, "nanite foliage/skinning" matches 5.7
    const result = computeDecayRisk("Rendering", "Nanite Foliage", []);
    expect(result.breakingVersion).toBe("5.7"); // Latest
  });

  it("handles invalid source dates gracefully", () => {
    const result = computeDecayRisk("AI", "State Trees", [
      { date: "not-a-date" },
      { date: null },
      { date: "" },
    ]);
    // No valid dates → medium (same as no-date case)
    expect(result.risk).toBe("medium");
  });
});

// ── UE5_BREAKING_CHANGES map ──────────────────────────────────────

describe("UE5_BREAKING_CHANGES", () => {
  it("has entries from UE 5.0 to 5.7", () => {
    expect(Object.keys(UE5_BREAKING_CHANGES)).toEqual(
      expect.arrayContaining(["5.0", "5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"])
    );
  });

  it("each version has a valid date and non-empty changes array", () => {
    for (const [_version, info] of Object.entries(UE5_BREAKING_CHANGES)) {
      expect(new Date(info.date).getTime()).not.toBeNaN();
      expect(info.changes.length).toBeGreaterThan(0);
    }
  });
});

// ── computeDemandIndex ─────────────────────────────────────────────

describe("computeDemandIndex", () => {
  // ── Edge cases ────────────────────────────────────────────────

  it("returns empty array unchanged", () => {
    expect(computeDemandIndex([])).toEqual([]);
  });

  it("returns undefined for null input", () => {
    expect(computeDemandIndex(null)).toBeNull();
  });

  it("adds demandIndex property to every suggestion", () => {
    const suggestions = makeBatch();
    computeDemandIndex(suggestions);
    for (const s of suggestions) {
      expect(s).toHaveProperty("demandIndex");
      expect(typeof s.demandIndex).toBe("number");
    }
  });

  it("demandIndex is always between 0 and 100", () => {
    const suggestions = makeBatch();
    computeDemandIndex(suggestions);
    for (const s of suggestions) {
      expect(s.demandIndex).toBeGreaterThanOrEqual(0);
      expect(s.demandIndex).toBeLessThanOrEqual(100);
    }
  });

  // ── 4-signal mode (base) ──────────────────────────────────────

  describe("4-signal mode (no YouTube, no Trends)", () => {
    it("uses weights α=0.30, β=0.30, γ=0.15, δ=0.25", () => {
      // Single suggestion → all signals normalize to max → index = sum of weights * 100
      const suggestions = [makeSuggestion()];
      computeDemandIndex(suggestions);
      // With 1 item, each normalized signal = 100, so index = (0.30+0.30+0.15+0.25)*100 = 100
      expect(suggestions[0].demandIndex).toBe(100);
    });

    it("does not attach youtubeMetrics or trendsMetrics", () => {
      const suggestions = [makeSuggestion()];
      computeDemandIndex(suggestions);
      expect(suggestions[0].youtubeMetrics).toBeUndefined();
      expect(suggestions[0].trendsMetrics).toBeUndefined();
    });

    it("ranks higher-demand suggestions above lower-demand ones", () => {
      const suggestions = makeBatch();
      computeDemandIndex(suggestions);
      // Sort by demandIndex descending
      const sorted = [...suggestions].sort((a, b) => b.demandIndex - a.demandIndex);
      expect(sorted[0].category).toBe("AI"); // Highest demandScore + gap
    });
  });

  // ── 5-signal mode (+YouTube) ──────────────────────────────────

  describe("5-signal mode (+YouTube)", () => {
    const youtubeMetrics = {
      AI: { avgViews: 50000, avgEngagement: 0.05, videoCount: 12, topVideo: { title: "Top AI", views: 100000, url: "https://yt.com/1" } },
      Blueprints: { avgViews: 30000, avgEngagement: 0.03, videoCount: 8, topVideo: { title: "Top BP", views: 60000, url: "https://yt.com/2" } },
      Rendering: { avgViews: 40000, avgEngagement: 0.04, videoCount: 10, topVideo: { title: "Top Render", views: 80000, url: "https://yt.com/3" } },
    };

    it("uses 5-signal weights when YouTube data is provided", () => {
      const suggestions = [makeSuggestion()];
      computeDemandIndex(suggestions, { youtubeMetrics });
      // With YouTube, sum of weights = 0.25+0.20+0.10+0.25+0.20 = 1.0
      // Single item → all normalize to 100 → index = 100
      expect(suggestions[0].demandIndex).toBe(100);
    });

    it("attaches youtubeMetrics to each suggestion", () => {
      const suggestions = makeBatch();
      computeDemandIndex(suggestions, { youtubeMetrics });
      expect(suggestions[0].youtubeMetrics).toBeDefined();
      expect(suggestions[0].youtubeMetrics.avgViews).toBe(50000);
      expect(suggestions[0].youtubeMetrics.topVideoTitle).toBe("Top AI");
    });

    it("does not attach trendsMetrics", () => {
      const suggestions = makeBatch();
      computeDemandIndex(suggestions, { youtubeMetrics });
      for (const s of suggestions) {
        expect(s.trendsMetrics).toBeUndefined();
      }
    });

    it("handles categories without YouTube data gracefully", () => {
      const suggestions = [makeSuggestion({ category: "Networking" })];
      computeDemandIndex(suggestions, { youtubeMetrics });
      expect(suggestions[0].demandIndex).toBeGreaterThanOrEqual(0);
      expect(suggestions[0].youtubeMetrics).toBeUndefined();
    });
  });

  // ── 6-signal mode (+YouTube + Trends) ─────────────────────────

  describe("6-signal mode (+YouTube + Trends)", () => {
    const youtubeMetrics = {
      AI: { avgViews: 50000, avgEngagement: 0.05, videoCount: 12 },
      Blueprints: { avgViews: 30000, avgEngagement: 0.03, videoCount: 8 },
      Rendering: { avgViews: 40000, avgEngagement: 0.04, videoCount: 10 },
    };
    const trendsData = {
      AI: { scaledScore: 85, rawInterest: 72 },
      Blueprints: { scaledScore: 60, rawInterest: 48 },
      Rendering: { scaledScore: 70, rawInterest: 55 },
    };

    it("uses 6-signal weights when both YouTube and Trends data provided", () => {
      const suggestions = [makeSuggestion()];
      computeDemandIndex(suggestions, { youtubeMetrics, trendsData });
      // Sum of weights = 0.20+0.15+0.10+0.20+0.15+0.20 = 1.0
      // Single item → all normalize to 100 → index = 100
      expect(suggestions[0].demandIndex).toBe(100);
    });

    it("attaches both youtubeMetrics and trendsMetrics", () => {
      const suggestions = makeBatch();
      computeDemandIndex(suggestions, { youtubeMetrics, trendsData });
      expect(suggestions[0].youtubeMetrics).toBeDefined();
      expect(suggestions[0].trendsMetrics).toBeDefined();
      expect(suggestions[0].trendsMetrics.scaledScore).toBe(85);
      expect(suggestions[0].trendsMetrics.rawInterest).toBe(72);
    });

    it("differentiates suggestions by trends score", () => {
      const suggestions = [
        makeSuggestion({ category: "AI", demandScore: 50, gap: 30 }),
        makeSuggestion({ category: "Blueprints", topic: "Blueprint Interfaces", demandScore: 50, gap: 30 }),
      ];
      computeDemandIndex(suggestions, { youtubeMetrics, trendsData });
      // AI has higher trends (85) vs Blueprints (60), should rank higher
      expect(suggestions[0].demandIndex).toBeGreaterThanOrEqual(suggestions[1].demandIndex);
    });

    it("caps trendsScore at 100", () => {
      const highTrends = { AI: { scaledScore: 150, rawInterest: 120 } };
      const suggestions = [makeSuggestion()];
      computeDemandIndex(suggestions, { youtubeMetrics, trendsData: highTrends });
      expect(suggestions[0].demandIndex).toBeLessThanOrEqual(100);
    });

    it("handles categories missing from trendsData", () => {
      const suggestions = [makeSuggestion({ category: "Networking" })];
      computeDemandIndex(suggestions, { youtubeMetrics, trendsData });
      expect(suggestions[0].demandIndex).toBeGreaterThanOrEqual(0);
      expect(suggestions[0].trendsMetrics).toBeUndefined();
    });
  });

  // ── Backward compatibility ────────────────────────────────────

  describe("backward compatibility", () => {
    it("produces identical results when no YouTube/Trends data passed (4-signal)", () => {
      const a = makeBatch();
      const b = makeBatch();
      computeDemandIndex(a);
      computeDemandIndex(b, {});
      for (let i = 0; i < a.length; i++) {
        expect(a[i].demandIndex).toBe(b[i].demandIndex);
      }
    });

    it("empty youtubeMetrics object falls back to 4-signal", () => {
      const a = makeBatch();
      const b = makeBatch();
      computeDemandIndex(a);
      computeDemandIndex(b, { youtubeMetrics: {} });
      for (let i = 0; i < a.length; i++) {
        expect(a[i].demandIndex).toBe(b[i].demandIndex);
      }
    });

    it("empty trendsData falls back to 5-signal when YouTube exists", () => {
      const ytMetrics = { AI: { avgViews: 10000 } };
      const a = makeBatch();
      const b = makeBatch();
      computeDemandIndex(a, { youtubeMetrics: ytMetrics });
      computeDemandIndex(b, { youtubeMetrics: ytMetrics, trendsData: {} });
      for (let i = 0; i < a.length; i++) {
        expect(a[i].demandIndex).toBe(b[i].demandIndex);
      }
    });

    it("allows weight overrides via opts", () => {
      const suggestions = [makeSuggestion()];
      computeDemandIndex(suggestions, { alpha: 1.0, beta: 0, gamma: 0, delta: 0 });
      // Only demandScore matters (weight=1.0), single item → 100
      expect(suggestions[0].demandIndex).toBe(100);
    });
  });

  // ── Normalization behavior ────────────────────────────────────

  describe("normalization", () => {
    it("highest-scoring suggestion gets demandIndex = 100 with uniform signals", () => {
      const suggestions = [
        makeSuggestion({ demandScore: 100, gap: 100, sourceCount: 7, redditEngagement: { postCount: 10, avgUpvotes: 50, avgComments: 16 } }),
        makeSuggestion({ demandScore: 10, gap: 5, sourceCount: 1, redditEngagement: { postCount: 1, avgUpvotes: 2, avgComments: 1 } }),
      ];
      computeDemandIndex(suggestions);
      expect(suggestions[0].demandIndex).toBe(100);
      expect(suggestions[1].demandIndex).toBeLessThan(suggestions[0].demandIndex);
    });

    it("single suggestion always gets demandIndex = 100", () => {
      // Any non-zero suggestion normalizes to max → all weights × 100 = 100
      const suggestions = [makeSuggestion({ demandScore: 1, gap: 1 })];
      computeDemandIndex(suggestions);
      expect(suggestions[0].demandIndex).toBe(100);
    });
  });
});

// ── computePlatformBreakdown ───────────────────────────────────────

describe("computePlatformBreakdown", () => {
  it("returns scores for all 7 platforms", () => {
    const suggestion = makeSuggestion();
    const breakdown = computePlatformBreakdown(suggestion);
    expect(breakdown).toHaveProperty("youtube");
    expect(breakdown).toHaveProperty("reddit");
    expect(breakdown).toHaveProperty("epicForum");
    expect(breakdown).toHaveProperty("devCommunity");
    expect(breakdown).toHaveProperty("communityIndex");
    expect(breakdown).toHaveProperty("tiktok");
    expect(breakdown).toHaveProperty("instagram");
  });

  it("identifies the dominant platform", () => {
    const suggestion = makeSuggestion({
      demandScore: 90,
      redditEngagement: { postCount: 10, avgUpvotes: 50, avgComments: 20 },
    });
    const breakdown = computePlatformBreakdown(suggestion);
    expect(breakdown.dominant).toBeDefined();
    expect(typeof breakdown.dominant).toBe("string");
  });

  it("reddit score is derived from engagement data", () => {
    const suggestion = makeSuggestion({
      redditEngagement: { postCount: 5, avgUpvotes: 20, avgComments: 8 },
    });
    const breakdown = computePlatformBreakdown(suggestion);
    // postCount*15 + avgUpvotes*3 + avgComments*5 = 75+60+40 = min(100, 175) = 100
    expect(breakdown.reddit).toBeGreaterThan(0);
  });

  it("handles suggestion with no sources or engagement", () => {
    const suggestion = makeSuggestion({
      sources: [],
      redditEngagement: {},
      demandScore: 0,
    });
    const breakdown = computePlatformBreakdown(suggestion);
    expect(breakdown.youtube).toBe(0);
    expect(breakdown.reddit).toBe(0);
    expect(breakdown.communityIndex).toBe(0);
    expect(breakdown.tiktok).toBe(0);
    expect(breakdown.instagram).toBe(0);
  });

  it("scores tiktok and instagram sources correctly", () => {
    const suggestion = makeSuggestion({
      sources: [
        { type: "tiktok", url: "https://tiktok.com/@ue5dev", title: "UE5 Tutorial" },
        { type: "tiktok", url: "https://tiktok.com/@gamedev", title: "Game Dev Tips" },
        { type: "instagram", url: "https://instagram.com/p/abc", title: "UE5 Reel" },
      ],
    });
    const breakdown = computePlatformBreakdown(suggestion);
    expect(breakdown.tiktok).toBe(50); // 2 sources * 25 = 50
    expect(breakdown.instagram).toBe(25); // 1 source * 25 = 25
  });
});
