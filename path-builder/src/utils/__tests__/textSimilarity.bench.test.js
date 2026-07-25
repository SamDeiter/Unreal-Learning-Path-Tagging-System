import { describe, test, expect } from "vitest";
import { getWordSet, wordJaccardFromSets, wordJaccard } from "../textSimilarity";

describe("textSimilarity Optimization & Benchmarks", () => {
  test("getWordSet tokenization matches behavior", () => {
    const text = "Lumen enables real-time global illumination and reflections in Unreal Engine";
    const set = getWordSet(text);

    // Check that we filter <= 2 chars (e.g., 'in' is filtered out)
    expect(set.has("lumen")).toBe(true);
    expect(set.has("enables")).toBe(true);
    expect(set.has("in")).toBe(false);
  });

  test("wordJaccardFromSets matches direct wordJaccard output", () => {
    const a = "Lumen enables real-time global illumination and reflections in Unreal Engine";
    const b = "Lumen enables real-time global illumination and reflections in Unreal Engine scenes";

    const score1 = wordJaccard(a, b);
    const score2 = wordJaccardFromSets(getWordSet(a), getWordSet(b));
    expect(score1).toBeCloseTo(score2, 5);
  });

  test("Performance benchmark of optimized Jaccard & precomputation", () => {
    // Generate a list of pseudo-random strings to simulate passages
    const passages = [];
    const baseWords = ["lumen", "enables", "real-time", "global", "illumination", "reflections", "unreal", "engine", "scenes", "nanite", "virtual", "shadow", "maps", "tutor", "performance", "optimization", "jaccard", "similarity", "deduplication", "search"];

    for (let i = 0; i < 120; i++) {
      const sentenceWords = [];
      const numWords = 8 + (i % 8);
      for (let j = 0; j < numWords; j++) {
        sentenceWords.push(baseWords[(i + j) % baseWords.length]);
      }
      passages.push(sentenceWords.join(" ") + ` content chunk index ${i}`);
    }

    // Measure old unoptimized Jaccard (re-allocating sets each comparison)
    const startOld = performance.now();
    const oldResults = [];
    for (let i = 0; i < passages.length; i++) {
      const current = passages[i];
      const isDupe = oldResults.some((kept) => {
        // Recompute sets inside some() loop
        const wordsA = new Set(
          (kept || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
        );
        const wordsB = new Set(
          (current || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
        );
        if (wordsA.size === 0 && wordsB.size === 0) return false;
        let intersection = 0;
        for (const w of wordsA) {
          if (wordsB.has(w)) intersection++;
        }
        const union = new Set([...wordsA, ...wordsB]).size;
        const score = union === 0 ? 0 : intersection / union;
        return score > 0.7;
      });
      if (!isDupe) oldResults.push(current);
    }
    const endOld = performance.now();
    const oldDuration = endOld - startOld;

    // Measure optimized Jaccard (precomputing sets & using Inclusion-Exclusion)
    const startNew = performance.now();
    const wordSetsMap = new Map();
    for (const p of passages) {
      wordSetsMap.set(p, getWordSet(p));
    }

    const newResults = [];
    for (const p of passages) {
      const pSet = wordSetsMap.get(p);
      const isDupe = newResults.some((kept) => {
        const keptSet = wordSetsMap.get(kept);
        return wordJaccardFromSets(keptSet, pSet) > 0.7;
      });
      if (!isDupe) newResults.push(p);
    }
    const endNew = performance.now();
    const newDuration = endNew - startNew;

    // Ensure results are identical
    expect(newResults.length).toBe(oldResults.length);
    expect(newResults).toEqual(oldResults);

    const speedup = oldDuration / newDuration;
    console.log(`[Performance Benchmark]`);
    console.log(`Unoptimized O(N²) loop duration (120 passages): ${oldDuration.toFixed(2)}ms`);
    console.log(`Optimized O(N) pre-calculating + O(N²) set comparison: ${newDuration.toFixed(2)}ms`);
    console.log(`Calculated Speedup: ${speedup.toFixed(2)}x`);

    // We expect a significant speedup (at least 2x)
    expect(speedup).toBeGreaterThan(2);
  });
});
