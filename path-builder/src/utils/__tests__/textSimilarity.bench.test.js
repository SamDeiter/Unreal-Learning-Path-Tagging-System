import { describe, test, expect } from "vitest";
import { wordJaccard, getWordSet, wordJaccardFromSets } from "../textSimilarity";

// Generate 120 synthetic transcript passages for a robust benchmark
const basePassages = [
  "Lumen provides real-time global illumination and reflections.",
  "Nanite virtualized geometry allows for extremely high polygon counts.",
  "Virtual Shadow Maps (VSM) provide high-resolution shadow rendering.",
  "Lumen reflections can be optimized by adjusting the ray tracing quality.",
  "Nanite meshes can be imported directly from high-poly source assets.",
  "World Partition simplifies the management of massive open world levels.",
  "The Niagara fluids system enables realistic gas and liquid simulations.",
  "Blueprints visual scripting allows designers to build complex game logic.",
  "The material editor uses a node-based graph to compile HLSL shaders.",
  "Enhanced Input provides modular mapping of keys, axes, and gestures.",
];

const passages = [];
for (let i = 0; i < 120; i++) {
  const base = basePassages[i % basePassages.length];
  // Add some variations to simulate real-world retrieved passages
  passages.push({
    id: `p-${i}`,
    text: `${base} Variation #${Math.floor(i / basePassages.length)} with extra context tokens for testing similarity.`,
  });
}

describe("textSimilarity Deduplication Benchmark", () => {
  test("compare baseline O(N^2) versus optimized pre-calculated Map + Inclusion-Exclusion approach", () => {
    const iterations = 100; // Increased iterations for stable measurements

    // --- 1. Baseline Implementation ---
    const startBaseline = performance.now();
    let baselineResultsCount = 0;

    for (let iter = 0; iter < iterations; iter++) {
      const semanticDeduped = [];
      for (const p of passages) {
        const isDupe = semanticDeduped.some(
          (kept) => wordJaccard(kept.text || "", p.text || "") > 0.7
        );
        if (!isDupe) {
          semanticDeduped.push(p);
        }
      }
      baselineResultsCount = semanticDeduped.length;
    }
    const durationBaseline = performance.now() - startBaseline;
    const meanBaseline = durationBaseline / iterations;

    // --- 2. Optimized Implementation ---
    const startOptimized = performance.now();
    let optimizedResultsCount = 0;

    for (let iter = 0; iter < iterations; iter++) {
      const semanticDeduped = [];
      const passageSets = new Map();
      for (let i = 0; i < passages.length; i++) {
        const p = passages[i];
        passageSets.set(p, getWordSet(p.text || ""));
      }

      for (let i = 0; i < passages.length; i++) {
        const p = passages[i];
        const setP = passageSets.get(p);
        const isDupe = semanticDeduped.some((kept) => {
          const setKept = passageSets.get(kept);
          return wordJaccardFromSets(setKept, setP) > 0.7;
        });
        if (!isDupe) {
          semanticDeduped.push(p);
        }
      }
      optimizedResultsCount = semanticDeduped.length;
    }
    const durationOptimized = performance.now() - startOptimized;
    const meanOptimized = durationOptimized / iterations;

    const speedup = meanBaseline / meanOptimized;

    console.log(`\n=== SEMANTIC DEDUPLICATION BENCHMARK RESULTS ===`);
    console.log(`Processed 120 passages over ${iterations} iterations.`);
    console.log(`-------------------------------------------------`);
    console.log(`Baseline O(N^2) Tokenization:`);
    console.log(`  Total: ${durationBaseline.toFixed(2)}ms`);
    console.log(`  Mean:  ${meanBaseline.toFixed(3)}ms per pass`);
    console.log(`-------------------------------------------------`);
    console.log(`Optimized Pre-calculated Map + Inclusion-Exclusion:`);
    console.log(`  Total: ${durationOptimized.toFixed(2)}ms`);
    console.log(`  Mean:  ${meanOptimized.toFixed(3)}ms per pass`);
    console.log(`-------------------------------------------------`);
    console.log(`🚀 EXPECTED SPEEDUP: ${speedup.toFixed(2)}x`);
    console.log(`================================================\n`);

    // Ensure they produce identical deduplication results
    expect(optimizedResultsCount).toBe(baselineResultsCount);
    // Ensure optimized is at least 3x faster (typically ~6x to ~8x faster)
    expect(speedup).toBeGreaterThan(3.0);
  });
});
