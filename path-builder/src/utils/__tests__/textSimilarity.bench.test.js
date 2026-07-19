import { describe, test, expect } from "vitest";
import { wordJaccard, getWordSet, wordJaccardFromSets } from "../textSimilarity";

describe("Semantic Deduplication Benchmark", () => {
  // Generate a set of 120 mock passages typical of transcript segments & doc links
  const baseTexts = [
    "Lumen enables real-time global illumination and high-quality reflections in Unreal Engine 5.",
    "Nanite virtualized geometry allows developers to import highly detailed film-quality assets directly.",
    "Virtual Shadow Maps provide highly detailed shadow rendering optimized for large open-world environments.",
    "World Partition simplifies large map management by dividing the world into a grid of streamable cells.",
    "Metasound provides high-performance node-based audio rendering within the sound engine.",
    "Control Rig enables customized procedural rigging and full-body IK solvers for characters.",
    "Enhanced Input System provides context-based input mapping and flexible modifier pipelines.",
    "Mass Entity provides high-performance data-oriented crowd simulation and simulation pipelines.",
    "Chaos Physics enables real-time high-fidelity destruction, fracturing, and physical simulations.",
    "Niagara Visual Effects system allows highly complex GPU-based particle simulations and systems."
  ];

  const passages = [];
  for (let i = 0; i < 120; i++) {
    const baseText = baseTexts[i % baseTexts.length];
    // Add variations to mimic different segments or minor differences in transcript/paraphrasing
    passages.push({
      id: `passage_${i}`,
      text: `${baseText} Variation count ${i}. ${i % 3 === 0 ? "Specifically covering Unreal Engine integration." : ""}`
    });
  }

  test("unoptimized vs optimized results are identical", () => {
    // 1. Unoptimized approach
    const unoptimizedResults = [];
    for (const p of passages) {
      const isDupe = unoptimizedResults.some(
        (kept) => wordJaccard(kept.text || "", p.text || "") > 0.7
      );
      if (!isDupe) unoptimizedResults.push(p);
    }

    // 2. Optimized approach
    const wordSets = new Map();
    for (const p of passages) {
      wordSets.set(p, getWordSet(p.text || ""));
    }

    const optimizedResults = [];
    for (const p of passages) {
      const setP = wordSets.get(p);
      const isDupe = optimizedResults.some(
        (kept) => wordJaccardFromSets(wordSets.get(kept), setP) > 0.7
      );
      if (!isDupe) optimizedResults.push(p);
    }

    expect(optimizedResults.length).toBe(unoptimizedResults.length);
    for (let i = 0; i < optimizedResults.length; i++) {
      expect(optimizedResults[i].id).toBe(unoptimizedResults[i].id);
    }
  });

  test("optimized approach is substantially faster", () => {
    // Warm up the JIT compiler
    for (let i = 0; i < 5; i++) {
      const wordSets = new Map();
      for (const p of passages) wordSets.set(p, getWordSet(p.text || ""));
      for (const p of passages) {
        const setP = wordSets.get(p);
        passages.some((k) => wordJaccardFromSets(wordSets.get(k), setP) > 0.7);
      }
    }

    // Benchmark Unoptimized
    const startLegacy = performance.now();
    const runs = 20;
    for (let r = 0; r < runs; r++) {
      const unoptimizedResults = [];
      for (const p of passages) {
        const isDupe = unoptimizedResults.some(
          (kept) => wordJaccard(kept.text || "", p.text || "") > 0.7
        );
        if (!isDupe) unoptimizedResults.push(p);
      }
    }
    const endLegacy = performance.now();
    const legacyDuration = (endLegacy - startLegacy) / runs;

    // Benchmark Optimized
    const startOptimized = performance.now();
    for (let r = 0; r < runs; r++) {
      const wordSets = new Map();
      for (const p of passages) {
        wordSets.set(p, getWordSet(p.text || ""));
      }

      const optimizedResults = [];
      for (const p of passages) {
        const setP = wordSets.get(p);
        const isDupe = optimizedResults.some(
          (kept) => wordJaccardFromSets(wordSets.get(kept), setP) > 0.7
        );
        if (!isDupe) optimizedResults.push(p);
      }
    }
    const endOptimized = performance.now();
    const optimizedDuration = (endOptimized - startOptimized) / runs;

    const speedup = legacyDuration / optimizedDuration;

    console.log(`\n--- Semantic Deduplication Benchmark (120 Passages) ---`);
    console.log(`Legacy Mean Duration:   ${legacyDuration.toFixed(3)} ms`);
    console.log(`Optimized Mean Duration: ${optimizedDuration.toFixed(3)} ms`);
    console.log(`Calculated Speedup:      ${speedup.toFixed(2)}x`);
    console.log(`--------------------------------------------------------\n`);

    // Expect at least 1.5x speedup
    expect(speedup).toBeGreaterThan(1.5);
  });
});
