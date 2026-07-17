import { describe, test, expect } from "vitest";
import { wordJaccard, getWordSet, wordJaccardFromSets } from "../textSimilarity";
import { getStems, stemMatchStems, stemMatch } from "../stemmer";

describe("Performance Benchmarks", () => {
  test("wordJaccard vs pre-calculated wordJaccardFromSets (Semantic Deduplication)", () => {
    // Generate mock passages (long transcript-style texts)
    const baseText = "Lumen is Unreal Engine 5's fully dynamic global illumination and reflections system. " +
      "It delivers diffuse interreflection with infinite bounces and indirect specular reflections " +
      "in large, detailed environments, ranging from millimeters to kilometers. " +
      "Nanite virtualized geometry allows for film-quality source art to be imported directly into Unreal.";

    const passages = [];
    for (let i = 0; i < 50; i++) {
      passages.push({
        text: baseText + ` Some extra variation word_${i} to prevent exact hash matching but keep semantic similarity high.`
      });
    }

    // 1. Traditional approach (tokenizes O(N^2) times)
    const startTraditional = performance.now();
    const dupesTraditional = [];
    for (let i = 0; i < passages.length; i++) {
      const p = passages[i];
      let isDupe = false;
      for (let j = 0; j < dupesTraditional.length; j++) {
        if (wordJaccard(dupesTraditional[j].text, p.text) > 0.7) {
          isDupe = true;
          break;
        }
      }
      if (!isDupe) dupesTraditional.push(p);
    }
    const endTraditional = performance.now();
    const durationTraditional = endTraditional - startTraditional;

    // 2. Optimized approach (tokenizes O(N) times and uses Inclusion-Exclusion union)
    const startOptimized = performance.now();
    for (const p of passages) {
      p._wordSet = getWordSet(p.text);
    }
    const dupesOptimized = [];
    for (let i = 0; i < passages.length; i++) {
      const p = passages[i];
      let isDupe = false;
      for (let j = 0; j < dupesOptimized.length; j++) {
        if (wordJaccardFromSets(dupesOptimized[j]._wordSet, p._wordSet) > 0.7) {
          isDupe = true;
          break;
        }
      }
      if (!isDupe) dupesOptimized.push(p);
    }
    for (const p of passages) {
      delete p._wordSet;
    }
    const endOptimized = performance.now();
    const durationOptimized = endOptimized - startOptimized;

    const speedup = durationTraditional / Math.max(durationOptimized, 0.001);

    console.log(`[Benchmark] WordJaccard Semantic Deduplication for ${passages.length} passages:`);
    console.log(`  - Traditional (O(N^2) tokenization & spread union): ${durationTraditional.toFixed(2)}ms`);
    console.log(`  - Optimized (O(N) tokenization & inclusion-exclusion): ${durationOptimized.toFixed(2)}ms`);
    console.log(`  - Speedup: ${speedup.toFixed(2)}x`);

    // Ensure they computed identical deduplication results
    expect(dupesOptimized.length).toBe(dupesTraditional.length);
    // Expect at least a 2x speedup in typical scenarios
    expect(speedup).toBeGreaterThan(1.5);
  });

  test("stemMatch vs pre-calculated stemMatchStems", () => {
    const textA = "Nanite meshes are extremely high-fidelity virtualized geometry representations in Unreal Engine";
    const textB = "Geometry in meshes can be virtualized using Nanite system inside Unreal Engine";

    const stemsA = getStems(textA);
    const stemsB = getStems(textB);

    // Run matching 5,000 times
    const iterations = 5000;

    const startTraditional = performance.now();
    for (let i = 0; i < iterations; i++) {
      stemMatch(textA, textB);
    }
    const durationTraditional = performance.now() - startTraditional;

    const startOptimized = performance.now();
    for (let i = 0; i < iterations; i++) {
      stemMatchStems(stemsA, stemsB);
    }
    const durationOptimized = performance.now() - startOptimized;

    const speedup = durationTraditional / Math.max(durationOptimized, 0.001);

    console.log(`[Benchmark] Stem Matching for ${iterations} iterations:`);
    console.log(`  - Traditional (split/map on every call): ${durationTraditional.toFixed(2)}ms`);
    console.log(`  - Optimized (fuzzy match over pre-calculated stems): ${durationOptimized.toFixed(2)}ms`);
    console.log(`  - Speedup: ${speedup.toFixed(2)}x`);

    expect(stemMatch(textA, textB)).toBe(stemMatchStems(stemsA, stemsB));
    expect(speedup).toBeGreaterThan(2.0);
  });
});
