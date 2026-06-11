import { describe, it, expect, beforeEach } from "vitest";
import {
  loadRecentQueries,
  saveRecentQuery,
  removeRecentQuery,
  clearRecentQueries,
  RECENT_QUERIES_KEY,
  MAX_RECENT,
} from "../utils/recentQueriesStore";

describe("recentQueriesStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("loadRecentQueries", () => {
    it("returns empty array when nothing stored", () => {
      expect(loadRecentQueries()).toEqual([]);
    });

    it("returns stored queries", () => {
      localStorage.setItem(RECENT_QUERIES_KEY, JSON.stringify(["q1", "q2"]));
      expect(loadRecentQueries()).toEqual(["q1", "q2"]);
    });

    it("returns empty array on corrupt JSON", () => {
      localStorage.setItem(RECENT_QUERIES_KEY, "not json!!!");
      expect(loadRecentQueries()).toEqual([]);
    });
  });

  describe("saveRecentQuery", () => {
    it("saves a query", () => {
      saveRecentQuery("How does Nanite work?");
      expect(loadRecentQueries()).toEqual(["How does Nanite work?"]);
    });

    it("puts newest query first", () => {
      saveRecentQuery("first");
      saveRecentQuery("second");
      expect(loadRecentQueries()).toEqual(["second", "first"]);
    });

    it("deduplicates — moves existing query to front", () => {
      saveRecentQuery("first");
      saveRecentQuery("second");
      saveRecentQuery("first"); // duplicate
      expect(loadRecentQueries()).toEqual(["first", "second"]);
    });

    it("caps at MAX_RECENT entries", () => {
      for (let i = 0; i < MAX_RECENT + 5; i++) {
        saveRecentQuery(`query ${i}`);
      }
      const result = loadRecentQueries();
      expect(result.length).toBe(MAX_RECENT);
      // Most recent should be first
      expect(result[0]).toBe(`query ${MAX_RECENT + 4}`);
    });

    it("ignores empty strings", () => {
      saveRecentQuery("");
      expect(loadRecentQueries()).toEqual([]);
    });

    it("ignores whitespace-only strings", () => {
      saveRecentQuery("   ");
      expect(loadRecentQueries()).toEqual([]);
    });

    it("trims whitespace from queries", () => {
      saveRecentQuery("  padded query  ");
      expect(loadRecentQueries()).toEqual(["padded query"]);
    });
  });

  describe("clearRecentQueries", () => {
    it("removes all queries", () => {
      saveRecentQuery("q1");
      saveRecentQuery("q2");
      clearRecentQueries();
      expect(loadRecentQueries()).toEqual([]);
    });
  });

  describe("removeRecentQuery", () => {
    it("removes a specific query", () => {
      saveRecentQuery("q1");
      saveRecentQuery("q2");
      removeRecentQuery("q1");
      expect(loadRecentQueries()).toEqual(["q2"]);
    });

    it("does nothing if query doesn't exist", () => {
      saveRecentQuery("q1");
      removeRecentQuery("non-existent");
      expect(loadRecentQueries()).toEqual(["q1"]);
    });

    it("trims input query", () => {
      saveRecentQuery("q1");
      removeRecentQuery("  q1  ");
      expect(loadRecentQueries()).toEqual([]);
    });
  });
});
