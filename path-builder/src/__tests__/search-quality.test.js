/**
 * Search Quality Regression Tests
 *
 * Known-answer tests that verify core search functions produce expected results
 * for common Unreal Engine problem queries. These act as a quality gate —
 * if any of these break, the search relevance has likely regressed.
 */
import { describe, it, expect } from "vitest";

// ── TagGraphService: Tag Extraction ────────────────────────────────────────────

import tgs from "../services/TagGraphService";

describe("TagGraphService – Known-Answer Tag Extraction", () => {
  it("should extract 'lumen' tag from a Lumen GI query", () => {
    const result = tgs.extractTagsFromText("Lumen global illumination is flickering");
    const tagIds = result.matchedTagIds.map((id) => id.toLowerCase());
    expect(tagIds.some((id) => id.includes("lumen"))).toBe(true);
  });

  it("should extract 'nanite' tag from a Nanite mesh query", () => {
    const result = tgs.extractTagsFromText("Nanite mesh is not rendering correctly");
    const tagIds = result.matchedTagIds.map((id) => id.toLowerCase());
    expect(tagIds.some((id) => id.includes("nanite"))).toBe(true);
  });

  it("should extract 'blueprint' tag from a Blueprint query", () => {
    const result = tgs.extractTagsFromText("My blueprint logic is broken after node reconnect");
    const tagIds = result.matchedTagIds.map((id) => id.toLowerCase());
    expect(tagIds.some((id) => id.includes("blueprint"))).toBe(true);
  });

  it("should extract 'material' tag from a material/shader query", () => {
    const result = tgs.extractTagsFromText("Material editor shows no preview");
    const tagIds = result.matchedTagIds.map((id) => id.toLowerCase());
    expect(tagIds.some((id) => id.includes("material"))).toBe(true);
  });

  it("should handle abbreviations like BP for Blueprint", () => {
    const result = tgs.extractTagsFromText("BP compile error on event graph");
    const tagIds = result.matchedTagIds.map((id) => id.toLowerCase());
    expect(tagIds.some((id) => id.includes("blueprint"))).toBe(true);
  });

  it("should handle negative intent (NOT Nanite)", () => {
    const result = tgs.extractTagsFromText("lumen reflections without nanite");
    const hasLumen = result.matchedTagIds.some((id) => id.toLowerCase().includes("lumen"));
    expect(hasLumen).toBe(true);
    expect(result.excludedTagIds.some((id) => id.toLowerCase().includes("nanite"))).toBe(true);
  });

  it("should return matches for error signature text", () => {
    const result = tgs.extractTagsFromText("LogRenderer: Warning: Skipping draw");
    // Just verify it runs without crashing and returns structure
    expect(result).toHaveProperty("matchedTagIds");
    expect(result).toHaveProperty("matches");
  });

  it("should return empty for completely irrelevant text", () => {
    const result = tgs.extractTagsFromText("The quick brown fox jumps over the lazy dog");
    expect(result.matchedTagIds.length).toBeLessThanOrEqual(1);
  });
});

// ── TagGraphService: Course Relevance Scoring ──────────────────────────────────

describe("TagGraphService – Course Relevance Scoring", () => {
  it("should score a course with matching tags higher than zero", () => {
    const course = {
      code: "TEST-001",
      canonical_tags: ["rendering.lumen", "rendering.gi"],
      ai_tags: ["global illumination"],
    };
    const result = tgs.scoreCourseRelevance(course, ["rendering.lumen"]);
    expect(result.score).toBeGreaterThan(0);
  });

  it("should score a course with no matching tags as zero", () => {
    const course = {
      code: "TEST-002",
      canonical_tags: ["animation.skeletal"],
      ai_tags: ["character animation"],
    };
    const result = tgs.scoreCourseRelevance(course, ["rendering.lumen"]);
    expect(result.score).toBe(0);
  });

  it("should score a course with multiple matching tags higher than one match", () => {
    const singleMatch = { code: "TEST-003", canonical_tags: ["rendering.lumen"] };
    const multiMatch = {
      code: "TEST-004",
      canonical_tags: ["rendering.lumen", "rendering.gi", "rendering.reflections"],
    };
    const tags = ["rendering.lumen", "rendering.gi", "rendering.reflections"];

    const singleResult = tgs.scoreCourseRelevance(singleMatch, tags);
    const multiResult = tgs.scoreCourseRelevance(multiMatch, tags);
    expect(multiResult.score).toBeGreaterThan(singleResult.score);
  });
});

// ── Cosine Similarity: Mathematical Properties ─────────────────────────────────

import { cosineSimilarity } from "../services/semanticSearchService";

describe("cosineSimilarity – Search quality invariants", () => {
  it("should return 1.0 for identical normalized vectors", () => {
    const v = [0.5, 0.3, 0.8, 0.1];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it("should return 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("should be commutative (sim(a,b) === sim(b,a))", () => {
    const a = [0.2, 0.8, 0.5, 0.1, 0.9];
    const b = [0.7, 0.3, 0.6, 0.4, 0.2];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it("should return higher score for more similar vectors", () => {
    const query = [1, 0, 0, 0];
    const close = [0.9, 0.1, 0.1, 0.1];
    const far = [0.1, 0.9, 0.1, 0.1];

    expect(cosineSimilarity(query, close)).toBeGreaterThan(cosineSimilarity(query, far));
  });

  it("should handle high-dimensional vectors (768-dim)", () => {
    const dim = 768;
    const a = Array.from({ length: dim }, (_, i) => Math.sin(i * 0.1));
    const b = Array.from({ length: dim }, (_, i) => Math.sin(i * 0.1 + 0.01));
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.99);
  });
});
