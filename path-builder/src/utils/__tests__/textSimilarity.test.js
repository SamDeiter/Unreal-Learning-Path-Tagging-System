import { describe, test, expect } from "vitest";
import { wordJaccard, getWordSet } from "../textSimilarity";

describe("wordJaccard", () => {
  test("identical texts return 1", () => {
    expect(wordJaccard("hello world test", "hello world test")).toBe(1);
  });

  test("completely different texts return 0", () => {
    expect(wordJaccard("alpha beta gamma", "delta epsilon zeta")).toBe(0);
  });

  test("partial overlap returns between 0 and 1", () => {
    const score = wordJaccard("lumen reflections flickering", "lumen lighting flickering issue");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  test("ignores short words (<=2 chars)", () => {
    // "is" and "a" should be filtered out
    expect(wordJaccard("this is a test", "this is a different")).toBe(
      wordJaccard("this test", "this different")
    );
  });

  test("case insensitive", () => {
    expect(wordJaccard("Hello World", "hello world")).toBe(1);
  });

  test("empty strings return 0", () => {
    expect(wordJaccard("", "")).toBe(0);
    expect(wordJaccard("hello", "")).toBe(0);
    expect(wordJaccard("", "hello")).toBe(0);
  });

  test("null/undefined inputs return 0", () => {
    expect(wordJaccard(null, null)).toBe(0);
    expect(wordJaccard(undefined, "test")).toBe(0);
  });

  test("high overlap detects near-duplicates", () => {
    const a = "Lumen enables real-time global illumination and reflections in Unreal Engine";
    const b = "Lumen enables real-time global illumination and reflections in Unreal Engine scenes";
    expect(wordJaccard(a, b)).toBeGreaterThan(0.7);
  });

  test("same topic but different content stays below threshold", () => {
    const a = "Setting up Nanite for static meshes requires enabling the plugin";
    const b = "Virtual shadow maps work with Nanite to provide detailed shadow rendering";
    expect(wordJaccard(a, b)).toBeLessThan(0.7);
  });

  test("handles pre-computed Sets", () => {
    const textA = "Lumen global illumination";
    const textB = "Lumen global illumination";
    const setA = getWordSet(textA);
    const setB = getWordSet(textB);
    expect(wordJaccard(setA, setB)).toBe(1);
    expect(wordJaccard(setA, textB)).toBe(1);
    expect(wordJaccard(textA, setB)).toBe(1);
  });
});
