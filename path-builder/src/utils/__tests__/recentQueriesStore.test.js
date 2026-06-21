import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadRecentQueries,
  saveRecentQuery,
  deleteRecentQuery,
  clearRecentQueries,
  RECENT_QUERIES_KEY,
} from "../recentQueriesStore";

describe("recentQueriesStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should return an empty array when no queries are saved", () => {
    expect(loadRecentQueries()).toEqual([]);
  });

  it("should save a query", () => {
    saveRecentQuery("test query");
    expect(loadRecentQueries()).toEqual(["test query"]);
  });

  it("should not save empty queries", () => {
    saveRecentQuery("");
    saveRecentQuery("   ");
    expect(loadRecentQueries()).toEqual([]);
  });

  it("should deduplicate queries and move them to the front", () => {
    saveRecentQuery("query 1");
    saveRecentQuery("query 2");
    saveRecentQuery("query 1");
    expect(loadRecentQueries()).toEqual(["query 1", "query 2"]);
  });

  it("should cap the number of recent queries", () => {
    for (let i = 1; i <= 15; i++) {
      saveRecentQuery(`query ${i}`);
    }
    const queries = loadRecentQueries();
    expect(queries.length).toBe(10);
    expect(queries[0]).toBe("query 15");
    expect(queries[9]).toBe("query 6");
  });

  it("should delete a specific query", () => {
    saveRecentQuery("query 1");
    saveRecentQuery("query 2");
    deleteRecentQuery("query 1");
    expect(loadRecentQueries()).toEqual(["query 2"]);
  });

  it("should clear all queries", () => {
    saveRecentQuery("query 1");
    clearRecentQueries();
    expect(loadRecentQueries()).toEqual([]);
  });

  it("should handle localStorage errors gracefully", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage error");
    });
    expect(loadRecentQueries()).toEqual([]);
  });
});
