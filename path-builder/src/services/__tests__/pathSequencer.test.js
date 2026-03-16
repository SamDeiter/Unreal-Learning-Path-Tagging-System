/**
 * pathSequencer.js — Unit tests
 *
 * Tests the pure-logic helpers: computeTopicOverlap, fallback sequencing,
 * constants, and input validation. Firebase AI calls are mocked.
 */
import { describe, it, expect, vi } from "vitest";

// Mock Firebase modules before importing pathSequencer
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
vi.mock("../../utils/pathQualityValidator", () => ({
  validatePathQuality: vi.fn((path) => ({
    cleanedPath: path,
    warnings: [],
    autoFixes: [],
  })),
}));

import {
  sequencePath,
  computeTopicOverlap,
  SEGMENT_CATEGORIES,
} from "../pathSequencer";

describe("pathSequencer", () => {
  // -- Constants --

  describe("Constants", () => {
    it("SEGMENT_CATEGORIES should have the 4 expected categories", () => {
      expect(SEGMENT_CATEGORIES).toEqual([
        "foundation",
        "diagnosis",
        "fix",
        "transfer",
      ]);
    });
  });

  // -- computeTopicOverlap (pure function) --

  describe("computeTopicOverlap", () => {
    it("should return 0 for empty/null inputs", () => {
      expect(computeTopicOverlap(null, "hello")).toBe(0);
      expect(computeTopicOverlap("hello", null)).toBe(0);
      expect(computeTopicOverlap("", "hello")).toBe(0);
    });

    it("should return 1 for trivial queries (all stop words)", () => {
      // Query with only stop words -> tokenize returns [] -> function returns 1
      expect(computeTopicOverlap("a the in", "some text")).toBe(1);
    });

    it("should return 1.0 for perfect overlap", () => {
      expect(computeTopicOverlap("blueprint variables", "Learn about blueprint variables here")).toBe(1);
    });

    it("should return 0 when no keywords match", () => {
      expect(computeTopicOverlap("nanite rendering", "blueprint scripting gameplay")).toBe(0);
    });

    it("should return partial overlap ratio", () => {
      // "blueprint" matches, "lighting" does not -> 0.5
      const result = computeTopicOverlap("blueprint lighting", "blueprint variables and events");
      expect(result).toBeCloseTo(0.5, 1);
    });

    it("should be case-insensitive", () => {
      const result = computeTopicOverlap("Blueprint", "BLUEPRINT variables");
      expect(result).toBe(1);
    });

    it("should ignore short words (<=2 chars)", () => {
      // "AI" is only 2 chars, gets filtered out by tokenize
      expect(computeTopicOverlap("AI", "AI system")).toBe(1); // trivial query, returns 1
    });
  });

  // -- sequencePath input validation --

  describe("sequencePath", () => {
    it("should return empty array for null/empty segments", async () => {
      expect(await sequencePath("test query", null)).toEqual([]);
      expect(await sequencePath("test query", [])).toEqual([]);
    });

    it("should use fallback sequencing when AI classification fails", async () => {
      const { httpsCallable } = await import("firebase/functions");
      httpsCallable.mockReturnValue(
        vi.fn(async () => ({ data: { text: "not valid json" } }))
      );

      const mockSegments = [
        { text: "First segment about blueprints", type: "transcript", similarity: 0.9 },
        { text: "Second segment about materials", type: "transcript", similarity: 0.8 },
        { text: "Third segment about lighting", type: "transcript", similarity: 0.7 },
      ];

      const result = await sequencePath("blueprint basics", mockSegments);
      expect(result.length).toBeGreaterThan(0);
      // Fallback assigns categories based on index position
      result.forEach((step) => {
        expect(SEGMENT_CATEGORIES).toContain(step.category);
        expect(step.order).toBeDefined();
      });
    });
  });
});
