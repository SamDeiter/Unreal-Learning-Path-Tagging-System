/**
 * pathSearch.js — Unit tests
 *
 * Tests constants, input validation, and filtering logic.
 * Firebase calls are mocked since the test environment has no Cloud Functions.
 */
import { describe, it, expect, vi } from "vitest";

// Mock Firebase modules before importing pathSearch
vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn()),
}));
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));
vi.mock("../tokenTracker", () => ({
  recordTokenUsage: vi.fn(),
}));
vi.mock("../../utils/retryWithBackoff", () => ({
  retryWithBackoff: vi.fn((fn) => fn()),
}));

import {
  findRelevantSegments,
  MAX_PATH_SEGMENTS,
  MIN_PATH_SEGMENTS,
  SIMILARITY_THRESHOLD,
} from "../pathSearch";

describe("pathSearch", () => {
  // -- Constants --

  describe("Constants", () => {
    it("MAX_PATH_SEGMENTS should be a positive integer", () => {
      expect(MAX_PATH_SEGMENTS).toBeGreaterThan(0);
      expect(Number.isInteger(MAX_PATH_SEGMENTS)).toBe(true);
    });

    it("MIN_PATH_SEGMENTS should be a positive integer", () => {
      expect(MIN_PATH_SEGMENTS).toBeGreaterThan(0);
      expect(Number.isInteger(MIN_PATH_SEGMENTS)).toBe(true);
    });

    it("MIN should be less than MAX", () => {
      expect(MIN_PATH_SEGMENTS).toBeLessThan(MAX_PATH_SEGMENTS);
    });

    it("SIMILARITY_THRESHOLD should be between 0 and 1", () => {
      expect(SIMILARITY_THRESHOLD).toBeGreaterThan(0);
      expect(SIMILARITY_THRESHOLD).toBeLessThanOrEqual(1);
    });
  });

  // -- findRelevantSegments input validation --

  describe("findRelevantSegments", () => {
    it("should return empty for null/empty/whitespace queries", async () => {
      expect(await findRelevantSegments(null)).toEqual({ segments: [], embedding: [] });
      expect(await findRelevantSegments("")).toEqual({ segments: [], embedding: [] });
      expect(await findRelevantSegments("   ")).toEqual({ segments: [], embedding: [] });
    });

    it("should return empty segments when embedding fails", async () => {
      // httpsCallable mock returns a function that resolves to no embedding
      const { httpsCallable } = await import("firebase/functions");
      httpsCallable.mockReturnValue(vi.fn(async () => ({ data: { embedding: null } })));

      const result = await findRelevantSegments("blueprint basics");
      expect(result.segments).toEqual([]);
    });
  });
});
