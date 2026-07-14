
import { describe, it } from 'vitest';
import { wordJaccard, getWordSet, wordJaccardFromSets } from '../textSimilarity';

// Simple benchmark utility
function benchmark(name, fn, iterations = 1000) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  console.log(`${name}: ${(end - start).toFixed(4)}ms for ${iterations} iterations`);
  return end - start;
}

describe('textSimilarity benchmark', () => {
  it('measures wordJaccard performance (baseline after internal optimization)', () => {
    const textA = "This is a relatively long string that we want to use for benchmarking the Jaccard similarity function. It contains several words that will be filtered out because they are too short.";
    const textB = "This is another relatively long string for benchmarking. It also has many words, some of which overlap with the first string to produce a non-zero similarity score.";

    benchmark('wordJaccard single call', () => {
      wordJaccard(textA, textB);
    }, 10000);
  });

  it('measures semantic dedup loop optimization', () => {
    const passages = Array.from({ length: 50 }, (_, i) => ({
      text: `This is passage number ${i}. It has some content that might be similar to other passages. Epic Games and Unreal Engine are mentioned here. Optimization is key to performance. ${i % 2 === 0 ? "Extra similarity here." : ""}`
    }));

    benchmark('LEGACY: dedup loop with wordJaccard', () => {
      const semanticDeduped = [];
      for (const p of passages) {
        const isDupe = semanticDeduped.some(
          (kept) => wordJaccard(kept.text || "", p.text || "") > 0.7
        );
        if (!isDupe) semanticDeduped.push(p);
      }
    }, 100);

    benchmark('OPTIMIZED: dedup loop with pre-calculated sets', () => {
      const passagesWithSets = passages.map((p) => ({
        ...p,
        _wordSet: getWordSet(p.text || ""),
      }));

      const semanticDeduped = [];
      for (const p of passagesWithSets) {
        const isDupe = semanticDeduped.some(
          (kept) => wordJaccardFromSets(kept._wordSet, p._wordSet) > 0.7
        );
        if (!isDupe) semanticDeduped.push(p);
      }
    }, 100);
  });
});
