/**
 * bloomClassifier — Unit tests
 *
 * Validates cognitive level classification, skill-level filtering,
 * and Bloom's badge metadata.
 */

import { describe, it, expect } from "vitest";
import {
  classifySegment,
  filterBySkillLevel,
  getBloomBadge,
  BLOOM_LEVELS,
} from "../../services/bloomClassifier";

describe("bloomClassifier", () => {
  describe("BLOOM_LEVELS", () => {
    it("contains exactly 6 levels in order", () => {
      expect(BLOOM_LEVELS).toEqual([
        "remember",
        "understand",
        "apply",
        "analyze",
        "evaluate",
        "create",
      ]);
    });
  });

  describe("classifySegment", () => {
    it("classifies 'Introduction to Blueprints' as remember", () => {
      const result = classifySegment("Introduction to Blueprints");
      expect(result.level).toBe("remember");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("classifies 'How does Nanite work' as understand", () => {
      const result = classifySegment("How does Nanite work");
      expect(result.level).toBe("understand");
    });

    it("classifies 'Step by Step Material Setup' as apply", () => {
      const result = classifySegment("Step by Step Material Setup");
      expect(result.level).toBe("apply");
    });

    it("classifies 'Compare static vs dynamic lighting' as analyze", () => {
      const result = classifySegment("Compare static vs dynamic lighting");
      expect(result.level).toBe("analyze");
    });

    it("classifies 'Best practices for performance optimization' as evaluate", () => {
      const result = classifySegment("Best practices for performance optimization");
      expect(result.level).toBe("evaluate");
    });

    it("classifies 'Design a custom render pipeline from scratch' as create", () => {
      const result = classifySegment("Design a custom render pipeline from scratch");
      expect(result.level).toBe("create");
    });

    it("returns apply as default for ambiguous text", () => {
      const result = classifySegment("random gibberish xyz");
      expect(result.level).toBe("apply");
      expect(result.confidence).toBe(0.3);
    });

    it("considers snippet text alongside title", () => {
      const result = classifySegment(
        "Lighting Chapter 5",
        "In this section we compare baked vs dynamic lighting trade-offs"
      );
      expect(result.level).toBe("analyze");
    });
  });

  describe("filterBySkillLevel", () => {
    const segments = [
      { title: "Introduction to Blueprints" }, // remember
      { title: "How to create a material" }, // apply
      { title: "Compare Nanite vs LODs" }, // analyze
      { title: "Design a custom pipeline from scratch" }, // create
    ];

    it("filters Beginner to remember+understand+apply levels", () => {
      const result = filterBySkillLevel(segments, "Beginner");
      // Should include remember and apply, exclude analyze and create
      expect(result.some((s) => s.bloom.level === "remember")).toBe(true);
      expect(result.some((s) => s.bloom.level === "apply")).toBe(true);
      expect(result.some((s) => s.bloom.level === "analyze")).toBe(false);
      expect(result.some((s) => s.bloom.level === "create")).toBe(false);
    });

    it("filters Advanced to analyze+evaluate+create levels", () => {
      const result = filterBySkillLevel(segments, "Advanced");
      expect(result.some((s) => s.bloom.level === "remember")).toBe(false);
      expect(result.some((s) => s.bloom.level === "analyze")).toBe(true);
      expect(result.some((s) => s.bloom.level === "create")).toBe(true);
    });

    it("attaches bloom metadata to each segment", () => {
      const result = filterBySkillLevel(segments, "Intermediate");
      result.forEach((seg) => {
        expect(seg.bloom).toBeDefined();
        expect(seg.bloom.level).toBeDefined();
        expect(seg.bloom.confidence).toBeGreaterThanOrEqual(0);
      });
    });

    it("defaults to Intermediate for unknown skill level", () => {
      const result = filterBySkillLevel(segments, "Unknown");
      // Intermediate allows understand, apply, analyze
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("getBloomBadge", () => {
    it("returns correct badge for each level", () => {
      const badge = getBloomBadge("remember");
      expect(badge.emoji).toBe("📋");
      expect(badge.label).toBe("Remember");
      expect(badge.color).toBe("#58a6ff");
    });

    it("returns apply badge for unknown level", () => {
      const badge = getBloomBadge("unknown");
      expect(badge.label).toBe("Apply");
    });

    it("has distinct colors for all 6 levels", () => {
      const colors = BLOOM_LEVELS.map((l) => getBloomBadge(l).color);
      const unique = new Set(colors);
      expect(unique.size).toBe(6);
    });
  });
});
