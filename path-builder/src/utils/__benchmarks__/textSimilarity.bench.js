import { bench, describe } from "vitest";
import { wordJaccard, getWordSet, wordJaccardFromSets } from "../textSimilarity";

describe("wordJaccard benchmark", () => {
  const text1 = "Lumen is UE5's new fully dynamic global illumination and reflections system. It is designed for next-generation consoles.";
  const text2 = "Lumen is the new dynamic global illumination system in Unreal Engine 5, providing real-time reflections and GI.";

  bench("wordJaccard (old/default - similar texts)", () => {
    wordJaccard(text1, text2);
  });

  bench("wordJaccardFromSets (new - similar texts)", () => {
    const set1 = getWordSet(text1);
    const set2 = getWordSet(text2);
    wordJaccardFromSets(set1, set2);
  });

  bench("semantic dedup loop simulation (20 passages) - OLD approach", () => {
    const passages = Array.from({ length: 20 }, (_, i) => ({
      text: i % 2 === 0 ? text1 + i : text2 + i
    }));

    const semanticDeduped = [];
    for (const p of passages) {
      const isDupe = semanticDeduped.some(
        (kept) => wordJaccard(kept.text || "", p.text || "") > 0.7
      );
      if (!isDupe) semanticDeduped.push(p);
    }
  });

  bench("semantic dedup loop simulation (20 passages) - NEW approach", () => {
    const passages = Array.from({ length: 20 }, (_, i) => ({
      text: i % 2 === 0 ? text1 + i : text2 + i
    }));

    const wordSetMap = new Map();
    for (const p of passages) {
      wordSetMap.set(p, getWordSet(p.text || ""));
    }

    const semanticDeduped = [];
    for (const p of passages) {
      const pSet = wordSetMap.get(p);
      const isDupe = semanticDeduped.some(
        (kept) => wordJaccardFromSets(wordSetMap.get(kept), pSet) > 0.7
      );
      if (!isDupe) semanticDeduped.push(p);
    }
  });
});
