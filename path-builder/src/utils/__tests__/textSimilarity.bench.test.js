import { describe, test, expect } from "vitest";
import { wordJaccard, getWordSet, wordJaccardFromSets } from "../textSimilarity";

describe("wordJaccard benchmark", () => {
  test("measure performance of semantic deduplication", () => {
    // Generate a list of realistic sample passages
    const rawPassages = [
      "Lumen enables real-time global illumination and reflections in Unreal Engine",
      "Lumen enables real-time global illumination and reflections in Unreal Engine scenes",
      "Setting up Nanite for static meshes requires enabling the plugin",
      "Virtual shadow maps work with Nanite to provide detailed shadow rendering",
      "Lumen is Unreal Engine's fully dynamic global illumination and reflections system",
      "Nanite virtualized geometry system allows you to achieve massive movie-quality detail",
      "With Nanite, rendering millions of polygons becomes extremely efficient in Unreal Engine 5",
      "Nanite uses a novel internal representation to stream and render ultra-high-detail source assets",
      "This is an empty or near-empty sentence for padding and noise testing",
      "Another different sentence to test the similarity algorithm behavior across unrelated topics",
    ];

    // Duplicate the passages to simulate a larger set (e.g. 120 passages)
    const passages = [];
    for (let i = 0; i < 12; i++) {
      for (const p of rawPassages) {
        passages.push({ text: `${p} - duplication iteration ${i}` });
      }
    }

    console.time("Baseline wordJaccard Deduplication");
    const baselineDeduped = [];
    for (const p of passages) {
      const isDupe = baselineDeduped.some(
        (kept) => wordJaccard(kept.text || "", p.text || "") > 0.7
      );
      if (!isDupe) {
        baselineDeduped.push(p);
      }
    }
    console.timeEnd("Baseline wordJaccard Deduplication");

    console.time("Optimized wordJaccard Deduplication");
    const wordSets = new Map();
    const optimizedDeduped = [];
    for (const p of passages) {
      const pText = p.text || "";
      let setP = wordSets.get(pText);
      if (!setP) {
        setP = getWordSet(pText);
        wordSets.set(pText, setP);
      }

      let isDupe = false;
      for (const kept of optimizedDeduped) {
        const keptText = kept.text || "";
        let setKept = wordSets.get(keptText);
        if (!setKept) {
          setKept = getWordSet(keptText);
          wordSets.set(keptText, setKept);
        }

        if (wordJaccardFromSets(setKept, setP) > 0.7) {
          isDupe = true;
          break;
        }
      }

      if (!isDupe) {
        optimizedDeduped.push(p);
      }
    }
    console.timeEnd("Optimized wordJaccard Deduplication");

    expect(optimizedDeduped.length).toBe(baselineDeduped.length);
  });
});
