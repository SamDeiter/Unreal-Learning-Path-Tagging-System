import { describe, test, expect } from "vitest";
import { getWordSet, wordJaccardFromSets } from "../textSimilarity";

// Original wordJaccard implementation for comparison
function originalWordJaccard(textA, textB) {
  const wordsA = new Set(
    (textA || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
  const wordsB = new Set(
    (textB || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );

  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

describe("textSimilarity Performance Benchmark", () => {
  test("measures semantic deduplication speedup", () => {
    // Generate 120 mock passages (typical RAG context size before slicing)
    const passages = [];
    const topics = [
      "Unreal Engine 5 and Lumen global illumination system",
      "Nanite virtualized geometry in static meshes and scenes",
      "Virtual shadow maps rendering for detailed shadow maps",
      "Chaos physics engine for rigid body dynamics and fracture",
      "PCG framework procedural content generation in UE5",
      "Niagara particle systems and visual effects simulation",
    ];

    for (let i = 0; i < 120; i++) {
      const topic = topics[i % topics.length];
      passages.push({
        text: `${topic} with additional noise words to simulate real transcript snippet number ${i}. This passage describes features of ${topic}.`
      });
    }

    // Benchmark 1: Original O(N^2) Approach (tokenization inside nested loop)
    const startOriginal = performance.now();
    const originalDeduped = [];
    for (const p of passages) {
      const isDupe = originalDeduped.some(
        (kept) => originalWordJaccard(kept.text, p.text) > 0.7
      );
      if (!isDupe) originalDeduped.push(p);
    }
    const durationOriginal = performance.now() - startOriginal;

    // Benchmark 2: Optimized O(N^2) Approach with Pre-Calculated Sets
    const startOptimized = performance.now();
    const wordSetsMap = new Map();
    for (const p of passages) {
      wordSetsMap.set(p, getWordSet(p.text));
    }

    const optimizedDeduped = [];
    for (const p of passages) {
      const setP = wordSetsMap.get(p);
      const isDupe = optimizedDeduped.some(
        (kept) => wordJaccardFromSets(wordSetsMap.get(kept), setP) > 0.7
      );
      if (!isDupe) optimizedDeduped.push(p);
    }
    const durationOptimized = performance.now() - startOptimized;

    // Verify correct and identical behavior
    expect(optimizedDeduped.length).toBe(originalDeduped.length);

    const speedup = durationOriginal / durationOptimized;

    console.log("-----------------------------------------");
    console.log(`[BENCHMARK] Semantic Deduplication (120 passages)`);
    console.log(`Original duration:  ${durationOriginal.toFixed(2)}ms`);
    console.log(`Optimized duration: ${durationOptimized.toFixed(2)}ms`);
    console.log(`Measured speedup:   ${speedup.toFixed(2)}x`);
    console.log("-----------------------------------------");

    // Make sure we didn't regress or fail to optimize
    expect(durationOptimized).toBeLessThan(durationOriginal);
  });
});
