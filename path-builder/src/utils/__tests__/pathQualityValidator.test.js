/**
 * pathQualityValidator.test.js — Unit tests for the post-generation quality gate.
 *
 * Verifies deduplication, phrasing corrections, and hallucination detection
 * work correctly before paths are displayed to users.
 */

import { describe, it, expect } from "vitest";
import { validatePathQuality } from "../../utils/pathQualityValidator";

describe("pathQualityValidator", () => {
  // ── DEDUPLICATION ──

  describe("deduplication", () => {
    it("removes duplicate segment indices across categories", () => {
      const steps = [
        {
          segmentIndex: 0,
          category: "foundation",
          segment: { title: "Blueprints" },
          summary: "Learn Blueprints",
        },
        {
          segmentIndex: 1,
          category: "diagnosis",
          segment: { title: "Variables" },
          summary: "Learn Variables",
        },
        {
          segmentIndex: 0,
          category: "transfer",
          segment: { title: "Blueprints" },
          summary: "Apply Blueprints",
        },
      ];

      const { cleanedPath, autoFixes } = validatePathQuality(steps);
      expect(cleanedPath).toHaveLength(2);
      expect(autoFixes.length).toBeGreaterThan(0);
      expect(autoFixes[0]).toContain("duplicate");
    });

    it("keeps all steps when no duplicates exist", () => {
      const steps = [
        { segmentIndex: 0, category: "foundation", segment: { title: "A" }, summary: "a" },
        { segmentIndex: 1, category: "diagnosis", segment: { title: "B" }, summary: "b" },
        { segmentIndex: 2, category: "transfer", segment: { title: "C" }, summary: "c" },
      ];

      const { cleanedPath } = validatePathQuality(steps);
      expect(cleanedPath).toHaveLength(3);
    });
  });

  // ── PHRASING CORRECTIONS ──

  describe("phrasing corrections", () => {
    it('replaces "without code" with correct Blueprint phrasing', () => {
      const steps = [
        {
          segmentIndex: 0,
          category: "foundation",
          segment: { title: "Intro" },
          summary: "Blueprints let designers create gameplay without code.",
        },
      ];

      const { cleanedPath, autoFixes } = validatePathQuality(steps);
      expect(cleanedPath[0].summary).toContain("without writing C++");
      expect(cleanedPath[0].summary).not.toContain("without code.");
      expect(autoFixes.length).toBeGreaterThan(0);
    });

    it('replaces "no code needed" with correct phrasing', () => {
      const steps = [
        {
          segmentIndex: 0,
          category: "foundation",
          segment: { title: "Intro" },
          summary: "No code is needed for this workflow.",
        },
      ];

      const { cleanedPath } = validatePathQuality(steps);
      expect(cleanedPath[0].summary).toContain("no C++ code is needed");
    });

    it("leaves correct phrasing unchanged", () => {
      const original =
        "Blueprints let designers implement logic without writing C++ or text-based code.";
      const steps = [
        {
          segmentIndex: 0,
          category: "foundation",
          segment: { title: "Intro" },
          summary: original,
        },
      ];

      const { cleanedPath, autoFixes } = validatePathQuality(steps);
      expect(cleanedPath[0].summary).toBe(original);
      expect(autoFixes).toHaveLength(0);
    });
  });

  // ── HALLUCINATION DETECTION ──

  describe("hallucination detection", () => {
    it("flags UE5 terms not found in source text", () => {
      const steps = [
        {
          segmentIndex: 0,
          category: "foundation",
          segment: { title: "Lighting" },
          summary: "Use the depth volume and wind volume to create atmospheric effects.",
        },
      ];
      const sourceSegments = [
        { text: "Adjust the directional light to change shadows.", title: "Lighting Basics" },
      ];

      const { warnings } = validatePathQuality(steps, sourceSegments);
      expect(warnings.length).toBeGreaterThanOrEqual(2);
      expect(warnings.some((w) => w.includes("depth volume"))).toBe(true);
      expect(warnings.some((w) => w.includes("wind volume"))).toBe(true);
    });

    it("does not flag terms that ARE in source text", () => {
      const steps = [
        {
          segmentIndex: 0,
          category: "foundation",
          segment: { title: "Niagara" },
          summary: "Use Niagara to create particle effects.",
        },
      ];
      const sourceSegments = [
        { text: "Niagara is the particle system in UE5.", title: "Particle Systems" },
      ];

      const { warnings } = validatePathQuality(steps, sourceSegments);
      const hallucinationWarnings = warnings.filter((w) => w.includes("hallucination"));
      expect(hallucinationWarnings).toHaveLength(0);
    });
  });

  // ── TITLE DEDUP WARNING ──

  describe("title dedup warning", () => {
    it("warns when same title appears in multiple categories", () => {
      const steps = [
        {
          segmentIndex: 0,
          category: "foundation",
          segment: { title: "What are Blueprints" },
          summary: "a",
        },
        {
          segmentIndex: 1,
          category: "transfer",
          segment: { title: "What are Blueprints" },
          summary: "b",
        },
      ];

      const { warnings } = validatePathQuality(steps);
      expect(warnings.some((w) => w.includes("what are blueprints"))).toBe(true);
    });
  });

  // ── EDGE CASES ──

  describe("edge cases", () => {
    it("handles null/undefined input gracefully", () => {
      const { cleanedPath, warnings } = validatePathQuality(null);
      expect(cleanedPath).toEqual([]);
      expect(warnings).toHaveLength(1);
    });

    it("handles empty array", () => {
      const { cleanedPath, warnings, autoFixes } = validatePathQuality([]);
      expect(cleanedPath).toEqual([]);
      expect(warnings).toHaveLength(0);
      expect(autoFixes).toHaveLength(0);
    });
  });
});
