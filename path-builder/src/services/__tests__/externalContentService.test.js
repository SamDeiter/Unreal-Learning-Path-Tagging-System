/**
 * externalContentService — Unit tests
 *
 * Tests the YouTube curated content service.
 * Mocks fetchJSON since the test environment has no HTTP server
 * to serve public/data/ files.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the real youtube_curated.json data for realistic tests
const ytData = JSON.parse(
  readFileSync(resolve(__dirname, "../../../public/data/youtube_curated.json"), "utf-8")
);

// Mock the dataLoader module so fetchJSON returns our local data
vi.mock("../dataLoader", () => ({
  fetchJSON: vi.fn(async (name) => {
    if (name === "youtube_curated") return ytData;
    return null;
  }),
  preloadJSON: vi.fn(),
  clearDataCache: vi.fn(),
}));

// Must dynamically import AFTER mocking to pick up the mock
let getResourcesForTopics, getResourcesForTagIds, getAllByChannel, getStats;

beforeEach(async () => {
  // Reset the module-level _ytData cache by re-importing
  vi.resetModules();

  // Re-mock after resetModules
  vi.doMock("../dataLoader", () => ({
    fetchJSON: vi.fn(async (name) => {
      if (name === "youtube_curated") return ytData;
      return null;
    }),
    preloadJSON: vi.fn(),
    clearDataCache: vi.fn(),
  }));

  const mod = await import("../externalContentService");
  getResourcesForTopics = mod.getResourcesForTopics;
  getResourcesForTagIds = mod.getResourcesForTagIds;
  getAllByChannel = mod.getAllByChannel;
  getStats = mod.getStats;
});

describe("externalContentService", () => {
  // -- getResourcesForTopics --

  describe("getResourcesForTopics", () => {
    it("should return empty array for empty topics", async () => {
      expect(await getResourcesForTopics([])).toEqual([]);
      expect(await getResourcesForTopics(null)).toEqual([]);
    });

    it("should return matching resources for known topics", async () => {
      const results = await getResourcesForTopics(["blueprint"]);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(r.id).toBeDefined();
        expect(r.title).toBeDefined();
        expect(r.url).toBeDefined();
        expect(r.source).toBe("epic_youtube");
      });
    });

    it("should respect the limit option", async () => {
      const all = await getResourcesForTopics(["blueprint"], { limit: 100 });
      const limited = await getResourcesForTopics(["blueprint"], { limit: 1 });
      expect(limited.length).toBeLessThanOrEqual(1);
      expect(all.length).toBeGreaterThanOrEqual(limited.length);
    });

    it("should respect maxTier option", async () => {
      const beginnerOnly = await getResourcesForTopics(["blueprint"], {
        maxTier: "beginner",
        limit: 100,
      });
      beginnerOnly.forEach((r) => {
        expect(r.tier).toBe("beginner");
      });
    });

    it("should not include internal scoring fields", async () => {
      const results = await getResourcesForTopics(["blueprint"]);
      results.forEach((r) => {
        expect(r._score).toBeUndefined();
        expect(r._isUE5).toBeUndefined();
      });
    });

    it("should include channelName and channelTrust", async () => {
      const results = await getResourcesForTopics(["blueprint"]);
      if (results.length > 0) {
        expect(results[0].channelName).toBeDefined();
        expect(results[0].channelTrust).toBe("official");
      }
    });
  });

  // -- getResourcesForTagIds --

  describe("getResourcesForTagIds", () => {
    it("should return empty array for empty tag IDs", async () => {
      expect(await getResourcesForTagIds([])).toEqual([]);
      expect(await getResourcesForTagIds(null)).toEqual([]);
    });

    it("should match resources by tag_ids", async () => {
      const results = await getResourcesForTagIds(["scripting.blueprint"]);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(r.source).toBe("epic_youtube");
        expect(r.tag_ids).toBeDefined();
      });
    });

    it("should respect limit option", async () => {
      const limited = await getResourcesForTagIds(["scripting.blueprint"], { limit: 1 });
      expect(limited.length).toBeLessThanOrEqual(1);
    });

    it("should not include internal _score field", async () => {
      const results = await getResourcesForTagIds(["scripting.blueprint"]);
      results.forEach((r) => {
        expect(r._score).toBeUndefined();
      });
    });
  });

  // -- getAllByChannel --

  describe("getAllByChannel", () => {
    it("should return an object grouped by channel key", async () => {
      const grouped = await getAllByChannel();
      expect(typeof grouped).toBe("object");
      const keys = Object.keys(grouped);
      expect(keys.length).toBeGreaterThan(0);
      keys.forEach((key) => {
        expect(grouped[key].channel).toBeDefined();
        expect(Array.isArray(grouped[key].resources)).toBe(true);
      });
    });
  });

  // -- getStats --

  describe("getStats", () => {
    it("should return total resources count", async () => {
      const stats = await getStats();
      expect(stats.totalResources).toBeGreaterThan(0);
    });

    it("should return channel count", async () => {
      const stats = await getStats();
      expect(stats.channels).toBeGreaterThan(0);
    });

    it("should return tier breakdown", async () => {
      const stats = await getStats();
      expect(typeof stats.byTier).toBe("object");
      // Should have at least one tier
      expect(Object.keys(stats.byTier).length).toBeGreaterThan(0);
    });
  });
});
