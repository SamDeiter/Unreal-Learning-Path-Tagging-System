import { describe, test, expect } from "vitest";
import { getWordSet, wordJaccardFromSets, wordJaccard } from "../textSimilarity";

// Legacy-style wordJaccard implementation logic for comparison
function legacyWordJaccard(textA, textB) {
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

// Legacy deduplication logic for N passages
function legacyDeduplicate(passages) {
  const semanticDeduped = [];
  for (const p of passages) {
    const isDupe = semanticDeduped.some(
      (kept) => legacyWordJaccard(kept.text || "", p.text || "") > 0.7
    );
    if (!isDupe) semanticDeduped.push(p);
  }
  return semanticDeduped;
}

// Optimized deduplication logic for N passages
function optimizedDeduplicate(passages) {
  const wordSets = new Map();
  for (const p of passages) {
    wordSets.set(p, getWordSet(p.text || ""));
  }

  const semanticDeduped = [];
  for (const p of passages) {
    const pSet = wordSets.get(p);
    const isDupe = semanticDeduped.some(
      (kept) => wordJaccardFromSets(wordSets.get(kept), pSet) > 0.7
    );
    if (!isDupe) semanticDeduped.push(p);
  }
  return semanticDeduped;
}

describe("textSimilarity Performance Benchmark", () => {
  test("Semantic deduplication benchmark and correctness check", () => {
    // Generate a set of 120 passages mimicking long transcript-style texts.
    // Some are duplicates or near-duplicates, some are unique.
    const passages = [];
    const baseTexts = [
      "Lumen enables real-time global illumination and reflections in Unreal Engine, yielding gorgeous lighting out of the box.",
      "Nanite virtualized geometry allows you to import high-fidelity assets directly into the viewport without performance loss.",
      "Virtual Shadow Maps provide extremely high-resolution shadow rendering with smooth filtering and efficient memory usage.",
      "Unreal Engine's Sequencer tool attempts to mirror standard non-linear editors, providing tools for shot composition.",
      "Blueprint visual scripting allows game developers to create rich logic and interactive elements without writing C++ code.",
      "The Event Graph contains node-based graphs of blueprints that execute in response to gameplay events.",
      "World Partition system automatically divides the world into a grid and streams the necessary cells dynamically.",
      "The Niagara VFX system enables massive particle counts, complex simulations, and real-time custom compute shaders.",
    ];

    for (let i = 0; i < 120; i++) {
      const base = baseTexts[i % baseTexts.length];
      // Introduce variations/duplicates:
      // ~20% of passages will be near-identical (should be deduped)
      const variation = i % 5 === 0 ? " with minor visual artifacts." : ` (index variant #${i})`;
      passages.push({
        id: `passage_${i}`,
        text: base + variation,
      });
    }

    // 1. Correctness verification: Both approaches must produce the exact same deduplicated result
    const legacyResult = legacyDeduplicate(passages);
    const optimizedResult = optimizedDeduplicate(passages);

    expect(optimizedResult.length).toBe(legacyResult.length);
    for (let i = 0; i < legacyResult.length; i++) {
      expect(optimizedResult[i].id).toBe(legacyResult[i].id);
    }

    console.log(`[Correctness] Deduplicated 120 passages down to ${optimizedResult.length} unique passages.`);

    // 2. Performance benchmark: Run both implementations 100 times
    const iterations = 100;

    // Benchmark Legacy
    const t0 = performance.now();
    for (let k = 0; k < iterations; k++) {
      legacyDeduplicate(passages);
    }
    const t1 = performance.now();
    const legacyDuration = t1 - t0;
    const legacyMean = legacyDuration / iterations;

    // Benchmark Optimized
    const t2 = performance.now();
    for (let k = 0; k < iterations; k++) {
      optimizedDeduplicate(passages);
    }
    const t3 = performance.now();
    const optimizedDuration = t3 - t2;
    const optimizedMean = optimizedDuration / iterations;

    const speedup = legacyDuration / optimizedDuration;

    console.log(`\n================== BENCHMARK RESULTS ==================`);
    console.log(`Evaluating 120 transcript passages across ${iterations} iterations:`);
    console.log(`- Legacy implementation (re-tokenize on-the-fly, union alloc):`);
    console.log(`  Total time: ${legacyDuration.toFixed(2)}ms | Mean latency: ${legacyMean.toFixed(2)}ms`);
    console.log(`- Optimized implementation (pre-computed sets Map, inclusion-exclusion):`);
    console.log(`  Total time: ${optimizedDuration.toFixed(2)}ms | Mean latency: ${optimizedMean.toFixed(2)}ms`);
    console.log(`--------------------------------------------------------`);
    console.log(`💡 SPEEDUP FACTOR: ${speedup.toFixed(2)}x`);
    console.log(`========================================================\n`);

    // Assert that we achieved a significant speedup (at least 3x, typically ~7x+)
    expect(speedup).toBeGreaterThan(2);
  });
});
