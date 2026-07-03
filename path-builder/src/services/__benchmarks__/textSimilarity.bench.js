import { bench, describe } from 'vitest'
import { wordJaccard, getWordSet, jaccardFromSets } from '../../utils/textSimilarity'

describe('wordJaccard performance', () => {
  const text1 = "The quick brown fox jumps over the lazy dog and runs away into the forest where it finds a cozy place to sleep."
  const text2 = "A fast brown fox leaps over a sleepy dog and disappears into the woods to find a comfortable spot for a nap."

  bench('wordJaccard baseline (original API)', () => {
    wordJaccard(text1, text2)
  })

  // Simulate searchPipeline loop
  const passages = Array.from({ length: 50 }, (_, i) => ({
    text: `Passage ${i}: ` + (i % 2 === 0 ? text1 : text2) + Math.random()
  }))

  bench('searchPipeline loop simulation (O(N^2) - Original)', () => {
    const semanticDeduped = [];
    for (const p of passages) {
      const isDupe = semanticDeduped.some(
        (kept) => wordJaccard(kept.text || "", p.text || "") > 0.7
      );
      if (!isDupe) semanticDeduped.push(p);
    }
  })

  bench('searchPipeline loop simulation (O(N^2) - Optimized)', () => {
    // Pre-calculate word sets (O(N))
    const passagesWithSets = passages.map((p) => ({
      ...p,
      wordSet: getWordSet(p.text || ""),
    }));

    const semanticDeduped = [];
    for (const p of passagesWithSets) {
      const isDupe = semanticDeduped.some(
        (kept) => jaccardFromSets(kept.wordSet, p.wordSet) > 0.7
      );
      if (!isDupe) semanticDeduped.push(p);
    }
    const _result = semanticDeduped.map(({ wordSet: _UNUSED_SET, ...p }) => p);
  })
})
