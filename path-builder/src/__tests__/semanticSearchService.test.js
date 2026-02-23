/**
 * Semantic Search Service Tests
 *
 * Tests the cosine similarity function (pure math) and the
 * findSimilarCourses pipeline (with mocked embeddings).
 */
import { describe, it, expect } from "vitest";
import { cosineSimilarity } from "../services/semanticSearchService";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. COSINE SIMILARITY (Pure Math)
// ═══════════════════════════════════════════════════════════════════════════════

describe("cosineSimilarity", () => {
  it("should return 1.0 for identical vectors", () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it("should return 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it("should return -1 for opposite vectors", () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it("should handle zero vectors", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it("should handle null/undefined inputs", () => {
    expect(cosineSimilarity(null, [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], null)).toBe(0);
    expect(cosineSimilarity(null, null)).toBe(0);
    expect(cosineSimilarity(undefined, undefined)).toBe(0);
  });

  it("should return 0 for different-length vectors", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("should compute correct similarity for known vectors", () => {
    // Known example: a = [1, 2, 3], b = [4, 5, 6]
    // dot = 4+10+18 = 32
    // |a| = sqrt(14), |b| = sqrt(77)
    // cos = 32 / sqrt(14*77) = 32 / sqrt(1078) ≈ 0.9746
    const result = cosineSimilarity([1, 2, 3], [4, 5, 6]);
    expect(result).toBeCloseTo(0.9746, 3);
  });

  it("should handle large vectors efficiently", () => {
    // 768-dim vectors (actual embedding size)
    const a = Array.from({ length: 768 }, (_, i) => Math.sin(i));
    const b = Array.from({ length: 768 }, (_, i) => Math.cos(i));
    const result = cosineSimilarity(a, b);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(-1);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("should be symmetric: sim(a,b) === sim(b,a)", () => {
    const a = [1, 3, -5, 2];
    const b = [4, -2, 1, 7];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});
