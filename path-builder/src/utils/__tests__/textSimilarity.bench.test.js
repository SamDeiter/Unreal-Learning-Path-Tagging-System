import { describe, test, expect } from "vitest";
import { wordJaccard } from "../textSimilarity";

// A mock collection of 120 passages simulating RAG retrieval results
const mockPassages = Array.from({ length: 120 }, (_, i) => ({
  text: `This is a sample passage number ${i} containing some interesting Unreal Engine 5 content about Lumen, Nanite, and shadows. Specifically, we want to see how performance scales when deduplicating a relatively large collection of passages using Jaccard word similarity. Let's make sure it has some length and a few repeating words here and there to be realistic. This is passage index: ${i % 10}.`
}));

// Original logic in searchPipeline.js
function originalSemanticDedup(passages) {
  const semanticDeduped = [];
  for (const p of passages) {
    const isDupe = semanticDeduped.some(
      (kept) => wordJaccard(kept.text || "", p.text || "") > 0.7
    );
    if (!isDupe) semanticDeduped.push(p);
  }
  return semanticDeduped;
}

// Optimized helper logic (which we will implement in textSimilarity.js)
function optimizedSemanticDedup(passages) {
  // We can duplicate the implementation here to measure before applying to the actual files
  function getWordSet(text) {
    if (!text) return new Set();
    const tokens = text.toLowerCase().match(/\S+/g) || [];
    const set = new Set();
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.length > 2) {
        set.add(token);
      }
    }
    return set;
  }

  function wordJaccardFromSets(wordsA, wordsB) {
    if (wordsA.size === 0 && wordsB.size === 0) return 0;
    let intersection = 0;
    const [smaller, larger] = wordsA.size < wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA];
    for (const w of smaller) {
      if (larger.has(w)) intersection++;
    }
    const unionSize = wordsA.size + wordsB.size - intersection;
    return unionSize === 0 ? 0 : intersection / unionSize;
  }

  const semanticDeduped = [];
  const wordSetsMap = new Map();
  for (const p of passages) {
    wordSetsMap.set(p, getWordSet(p.text || ""));
  }

  for (const p of passages) {
    const pSet = wordSetsMap.get(p);
    const isDupe = semanticDeduped.some(
      (kept) => wordJaccardFromSets(wordSetsMap.get(kept), pSet) > 0.7
    );
    if (!isDupe) {
      semanticDeduped.push(p);
    }
  }
  return semanticDeduped;
}

describe("Semantic Deduplication Benchmark", () => {
  test("Measure and compare performance", () => {
    // Warm-up
    originalSemanticDedup(mockPassages);
    optimizedSemanticDedup(mockPassages);

    // Benchmark Original
    const startOriginal = performance.now();
    let resOriginal;
    for (let i = 0; i < 50; i++) {
      resOriginal = originalSemanticDedup(mockPassages);
    }
    const endOriginal = performance.now();
    const timeOriginal = (endOriginal - startOriginal) / 50;

    // Benchmark Optimized
    const startOptimized = performance.now();
    let resOptimized;
    for (let i = 0; i < 50; i++) {
      resOptimized = optimizedSemanticDedup(mockPassages);
    }
    const endOptimized = performance.now();
    const timeOptimized = (endOptimized - startOptimized) / 50;

    console.log(`\n=== SEMANTIC DEDUPLICATION BENCHMARK (120 Passages) ===`);
    console.log(`Original Time (mean of 50 runs):  ${timeOriginal.toFixed(2)}ms`);
    console.log(`Optimized Time (mean of 50 runs): ${timeOptimized.toFixed(2)}ms`);
    const speedup = timeOriginal / timeOptimized;
    console.log(`Speedup Factor:                   ${speedup.toFixed(2)}x`);
    console.log(`=======================================================\n`);

    // Ensure outputs are identical
    expect(resOriginal.length).toEqual(resOptimized.length);
    expect(speedup).toBeGreaterThan(1);
  });
});
