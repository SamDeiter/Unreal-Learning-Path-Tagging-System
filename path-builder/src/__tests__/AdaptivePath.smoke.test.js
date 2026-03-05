import { describe, it, expect, beforeEach } from "vitest";
import {
  loadRecentQueries,
  saveRecentQuery,
  clearRecentQueries,
} from "../utils/recentQueriesStore";

/**
 * AdaptivePath Component Smoke Tests
 *
 * Lightweight tests that verify the component's data flow
 * WITHOUT requiring full React rendering (no React Testing Library needed).
 * Tests the integration between localStorage and the component's data model.
 */

describe("AdaptivePath data integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Recent Queries rendering logic", () => {
    it("returns empty array on first visit (no cards rendered)", () => {
      const queries = loadRecentQueries();
      expect(queries.length).toBe(0);
      // Component: recentQueries.length > 0 is false → section hidden
    });

    it("returns populated array after queries (cards rendered)", () => {
      saveRecentQuery("How does Nanite work in UE5?");
      saveRecentQuery("Blueprint communication patterns");
      const queries = loadRecentQueries();
      expect(queries.length).toBe(2);
      // Component: recentQueries.length > 0 is true → section shown
      expect(queries[0]).toBe("Blueprint communication patterns"); // newest first
    });

    it("clicking a card sets input (simulated)", () => {
      saveRecentQuery("Lumen lighting setup");
      const queries = loadRecentQueries();
      // Simulate: onClick={() => setQuery(q)}
      const simulatedQuery = queries[0];
      expect(simulatedQuery).toBe("Lumen lighting setup");
      expect(typeof simulatedQuery).toBe("string");
      expect(simulatedQuery.length).toBeGreaterThan(0);
    });
  });

  describe("handleStart flow", () => {
    it("saves query to recent list after generation", () => {
      // Simulate the handleStart flow:
      // 1. User types query
      const query = "Why is my mesh flickering in UE5?";
      // 2. sanitizeQuery validates it (tested separately)
      // 3. recordQuery logs for rate limit (tested separately)
      // 4. saveRecentQuery persists to localStorage
      saveRecentQuery(query);
      // 5. loadRecentQueries refreshes state
      const updated = loadRecentQueries();
      expect(updated).toContain(query);
    });

    it("maintains order after multiple queries", () => {
      saveRecentQuery("First question about blueprints");
      saveRecentQuery("Second question about materials");
      saveRecentQuery("Third question about Nanite");
      const queries = loadRecentQueries();
      expect(queries[0]).toBe("Third question about Nanite");
      expect(queries[1]).toBe("Second question about materials");
      expect(queries[2]).toBe("First question about blueprints");
    });

    it("clear function resets state to empty", () => {
      saveRecentQuery("test query here now");
      clearRecentQueries();
      expect(loadRecentQueries()).toEqual([]);
    });
  });

  describe("PreSeeded paths integration", () => {
    it("PRE_SEEDED_PATHS data shape is valid (smoke check)", async () => {
      // Dynamic import to verify the data file loads
      const { default: paths } = await import("../data/preSeededPaths");
      expect(Array.isArray(paths)).toBe(true);
      expect(paths.length).toBeGreaterThan(0);
      // Each path should have at minimum a query
      for (const p of paths) {
        expect(p).toHaveProperty("query");
        expect(typeof p.query).toBe("string");
      }
    });
  });
});
