import { describe, test, expect } from "vitest";
import { wordJaccard, getWordSet, wordJaccardFromSets } from "../textSimilarity";

describe("wordJaccard micro-benchmark", () => {
  test("measure performance gains", () => {
    // Generate a list of pseudo-passages representing RAG results
    const passages = Array.from({ length: 120 }, (_, i) => ({
      text: `Lumen enables real-time global illumination and reflections in Unreal Engine for scene index ${i}. This covers rendering, shadows, and lightning.`,
    }));

    // Baseline implementation: wordJaccard called repeatedly in O(N^2)
    const startBaseline = performance.now();
    const baselineResults = [];
    for (let i = 0; i < passages.length; i++) {
      const p = passages[i];
      const isDupe = baselineResults.some(
        (kept) => wordJaccard(kept.text || "", p.text || "") > 0.7
      );
      if (!isDupe) baselineResults.push(p);
    }
    const endBaseline = performance.now();
    const durationBaseline = endBaseline - startBaseline;

    // Optimized implementation: pre-calculate word sets and call wordJaccardFromSets
    const startOptimized = performance.now();
    const wordSetCache = new Map();
    for (let i = 0; i < passages.length; i++) {
      wordSetCache.set(passages[i], getWordSet(passages[i].text || ""));
    }

    const optimizedResults = [];
    for (let i = 0; i < passages.length; i++) {
      const p = passages[i];
      const pSet = wordSetCache.get(p);
      const isDupe = optimizedResults.some(
        (kept) => wordJaccardFromSets(wordSetCache.get(kept), pSet) > 0.7
      );
      if (!isDupe) optimizedResults.push(p);
    }
    const endOptimized = performance.now();
    const durationOptimized = endOptimized - startOptimized;

    const speedup = durationBaseline / durationOptimized;

    console.log(`[Benchmark] Baseline O(N^2) Jaccard: ${durationBaseline.toFixed(2)}ms`);
    console.log(`[Benchmark] Optimized Pre-calc Jaccard: ${durationOptimized.toFixed(2)}ms`);
    console.log(`[Benchmark] Speedup factor: ${speedup.toFixed(2)}x`);

    // Ensure they both output identical results
    expect(optimizedResults.length).toBe(baselineResults.length);
    expect(speedup).toBeGreaterThan(1.5); // Ensure a substantial speedup
  });
});
