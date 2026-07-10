
import { describe, bench } from 'vitest';
import { wordJaccard, getWordSet, wordJaccardFromSets } from '../textSimilarity';

describe('wordJaccard performance', () => {
  const text1 = "Unreal Engine 5 is a powerful game development tool with many features like Lumen and Nanite.";
  const text2 = "UE5 is a great tool for game developers, featuring Lumen lighting and Nanite geometry.";
  const text3 = "This is a completely different sentence about something else entirely, like cooking recipes.";

  bench('naive wordJaccard (small)', () => {
    wordJaccard(text1, text2);
    wordJaccard(text1, text3);
  });

  const set1 = getWordSet(text1);
  const set2 = getWordSet(text2);
  const set3 = getWordSet(text3);

  bench('optimized wordJaccardFromSets (small)', () => {
    wordJaccardFromSets(set1, set2);
    wordJaccardFromSets(set1, set3);
  });

  const longText1 = text1.repeat(50);
  const longText2 = text2.repeat(50);

  bench('naive wordJaccard (long)', () => {
    wordJaccard(longText1, longText2);
  });

  const longSet1 = getWordSet(longText1);
  const longSet2 = getWordSet(longText2);

  bench('optimized wordJaccardFromSets (long)', () => {
    wordJaccardFromSets(longSet1, longSet2);
  });

  // Simulation of the deduplication loop with 20 passages
  const passages = Array.from({ length: 20 }, (_, i) => ({
    text: `Passage ${i}: ` + (i % 2 === 0 ? text1 : text2) + ` some extra content ${i}`
  }));

  bench('deduplication simulation (naive)', () => {
    const deduped = [];
    for (const p of passages) {
      const isDupe = deduped.some(
        (kept) => wordJaccard(kept.text, p.text) > 0.7
      );
      if (!isDupe) deduped.push(p);
    }
  });

  bench('deduplication simulation (optimized)', () => {
    const deduped = [];
    const passageWordSets = new Map();
    for (const p of passages) {
      const pSet = getWordSet(p.text);
      const isDupe = deduped.some((kept) => {
        const keptSet = passageWordSets.get(kept);
        return wordJaccardFromSets(keptSet, pSet) > 0.7;
      });
      if (!isDupe) {
        deduped.push(p);
        passageWordSets.set(p, pSet);
      }
    }
  });
});
