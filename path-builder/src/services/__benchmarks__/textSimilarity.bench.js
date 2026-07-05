import { bench, describe } from "vitest";
import { wordJaccard } from "../../utils/textSimilarity";

describe("wordJaccard and deduplication Benchmark", () => {
  const text1 = "This is a sample passage about Unreal Engine 5 and Lumen lighting system. It covers flickering and reflections.";
  const text2 = "Another passage discussing Unreal Engine 5, specifically the Lumen GI and how to fix flickering in reflections.";
  const text3 = "A completely different topic about Blueprint scripting and node-based logic in UE5.";

  const passages = Array.from({ length: 50 }, (_, i) => ({
    text: i % 2 === 0 ? text1 : (i % 3 === 0 ? text2 : text3),
    id: i
  }));

  // Tokenize once for optimized tests
  const set1 = new Set((text1 || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const set2 = new Set((text2 || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2));

  bench("wordJaccard - baseline (string input)", () => {
    wordJaccard(text1, text2);
  });

  bench("wordJaccard - optimized (Set input)", () => {
    wordJaccard(set1, set2);
  });

  bench("Deduplication loop - baseline", () => {
    const semanticDeduped = [];
    for (const p of passages) {
      const isDupe = semanticDeduped.some(
        (kept) => wordJaccard(kept.text || "", p.text || "") > 0.7
      );
      if (!isDupe) semanticDeduped.push(p);
    }
  });

  bench("Deduplication loop - optimized", () => {
    const passageWordSets = new Map();
    const getWordSet = (text) => {
      if (passageWordSets.has(text)) return passageWordSets.get(text);
      const words = new Set(
        (text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
      );
      passageWordSets.set(text, words);
      return words;
    };

    const semanticDeduped = [];
    for (const p of passages) {
      const currentSet = getWordSet(p.text);
      const isDupe = semanticDeduped.some(
        (kept) => wordJaccard(getWordSet(kept.text), currentSet) > 0.7
      );
      if (!isDupe) semanticDeduped.push(p);
    }
  });
});
