/**
 * diagnosisCacheUtils.test.js — Unit tests for diagnosis caching
 */
const { cosineSimilarity } = require("../diagnosisCacheUtils");

describe("diagnosisCacheUtils", () => {
  describe("cosineSimilarity", () => {
    it("returns 1 for identical vectors", () => {
      const v = [1, 0, 0];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
    });

    it("returns 0 for orthogonal vectors", () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
    });

    it("returns -1 for opposite vectors", () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
    });

    it("returns 0 for zero vectors", () => {
      expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
    });

    it("returns 0 for null/mismatched inputs", () => {
      expect(cosineSimilarity(null, [1, 0])).toBe(0);
      expect(cosineSimilarity([1], [1, 0])).toBe(0);
      expect(cosineSimilarity([1, 0], null)).toBe(0);
    });

    it("computes correctly for known vectors", () => {
      // cos(45°) ≈ 0.7071
      const a = [1, 0];
      const b = [1, 1];
      const expected = 1 / Math.sqrt(2);
      expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 4);
    });
  });
});
