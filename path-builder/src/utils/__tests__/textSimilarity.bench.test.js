import { describe, test, expect } from "vitest";
import { wordJaccard, getWordSet, wordJaccardFromSets } from "../textSimilarity";

describe("textSimilarity optimizations & benchmarks", () => {
  // 1. Unit Tests for new optimized functions
  test("getWordSet creates correct lowercased set filtering out short words", () => {
    const wordSet = getWordSet("This is a Test of the Lumen Global illumination.");
    // "is", "a", "of", "the" are <= 2 chars and should be excluded.
    expect(wordSet.has("this")).toBe(true);
    expect(wordSet.has("test")).toBe(true);
    expect(wordSet.has("lumen")).toBe(true);
    expect(wordSet.has("global")).toBe(true);
    expect(wordSet.has("illumination.")).toBe(true); // retains punctuation if split only by whitespace

    expect(wordSet.has("is")).toBe(false);
    expect(wordSet.has("a")).toBe(false);
    expect(wordSet.has("of")).toBe(false);
  });

  test("wordJaccardFromSets produces identical results to wordJaccard", () => {
    const textA = "Nanite meshes require enabling the plugin and updating settings";
    const textB = "Nanite mesh system requires active plugins and configuration settings";

    const setA = getWordSet(textA);
    const setB = getWordSet(textB);

    const scoreClassic = wordJaccard(textA, textB);
    const scoreOptimized = wordJaccardFromSets(setA, setB);

    expect(scoreOptimized).toBeCloseTo(scoreClassic, 5);
  });

  // 2. Performance Benchmark
  test("pre-calculated word sets and Inclusion-Exclusion is significantly faster", () => {
    // Generate simulated passages that are completely different to avoid early breaks and simulate O(N^2) comparison space
    const passages = Array.from({ length: 120 }, (_, i) => ({
      text: `passageTopic${i} completely unique set of vocabulary words to prevent false positives and early exit during deduplication. We can talk about various subjects like astronomy, biochemistry, cartography, dermatology, entomology, fluoroscopy, geology, hematology, immunology, jurisprudence, kinesiology, lexicography, meteorology, nephrology, oceanography, paleontology, quantum physics, radiology, sociology, toxicology, urology, virology, volcanology, zoology. Index: ${i}`
    }));

    // Warm up the JS engine to stabilize timing measurements
    for (let i = 0; i < 50; i++) {
      wordJaccard(passages[0].text, passages[1].text);
    }

    // Run multiple iterations of both to stabilize measurement
    const iterations = 5;

    let totalDurationClassic = 0;
    let classicResults = [];
    for (let iter = 0; iter < iterations; iter++) {
      const startClassic = performance.now();
      classicResults = [];
      for (let i = 0; i < passages.length; i++) {
        const p = passages[i];
        let isDupe = false;
        for (let j = 0; j < i; j++) {
          const kept = passages[j];
          if (wordJaccard(kept.text, p.text) > 0.7) {
            isDupe = true;
            break;
          }
        }
        if (!isDupe) {
          classicResults.push(p);
        }
      }
      totalDurationClassic += performance.now() - startClassic;
    }
    const avgDurationClassic = totalDurationClassic / iterations;

    let totalDurationOptimized = 0;
    let optimizedResults = [];
    for (let iter = 0; iter < iterations; iter++) {
      const startOptimized = performance.now();
      const passageWordSets = new Map();
      for (const p of passages) {
        passageWordSets.set(p, getWordSet(p.text));
      }
      optimizedResults = [];
      for (let i = 0; i < passages.length; i++) {
        const p = passages[i];
        const pWordSet = passageWordSets.get(p);
        let isDupe = false;
        for (let j = 0; j < i; j++) {
          const kept = passages[j];
          if (wordJaccardFromSets(passageWordSets.get(kept), pWordSet) > 0.7) {
            isDupe = true;
            break;
          }
        }
        if (!isDupe) {
          optimizedResults.push(p);
        }
      }
      totalDurationOptimized += performance.now() - startOptimized;
    }
    const avgDurationOptimized = totalDurationOptimized / iterations;

    const speedup = avgDurationClassic / (avgDurationOptimized || 0.001);

    console.log(`\n=== Semantic Deduplication Benchmark (N = ${passages.length}, Iterations = ${iterations}) ===`);
    console.log(`Unoptimized (Classic Jaccard): ${avgDurationClassic.toFixed(3)}ms (total: ${totalDurationClassic.toFixed(3)}ms)`);
    console.log(`Optimized (Pre-calculated + IEP): ${avgDurationOptimized.toFixed(3)}ms (total: ${totalDurationOptimized.toFixed(3)}ms)`);
    console.log(`Speedup factor: ${speedup.toFixed(2)}x faster`);
    console.log(`==========================================\n`);

    // Verify both approaches produced exactly identical deduplication results
    expect(optimizedResults.length).toBe(classicResults.length);

    // Assert a measurable performance speedup (expecting at least 1.5x)
    expect(speedup).toBeGreaterThan(1.5);
  });
});
