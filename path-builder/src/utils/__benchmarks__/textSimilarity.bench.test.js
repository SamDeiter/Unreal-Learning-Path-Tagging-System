import { describe, test } from "vitest";
import { wordJaccard } from "../textSimilarity";

// Optimized version (what we want to implement)
function getWordSet(text) {
  return new Set(
    (text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
}

function wordJaccardFromSets(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  // Iterate over smaller set for intersection
  const [smaller, larger] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  for (const w of smaller) {
    if (larger.has(w)) intersection++;
  }

  // Union size = |A| + |B| - |A ∩ B|
  const unionSize = setA.size + setB.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}

describe("wordJaccard benchmark", () => {
  const passages = [
    "Lumen enables real-time global illumination and reflections in Unreal Engine. It is highly optimized for modern hardware.",
    "Lumen enables real-time global illumination and reflections in Unreal Engine scenes using software ray tracing.",
    "Setting up Nanite for static meshes requires enabling the plugin and restarting the editor for changes to take effect.",
    "Virtual shadow maps work with Nanite to provide detailed shadow rendering in complex scenes with many instances.",
    "The search pipeline uses semantic deduplication to remove redundant passages from the final results set.",
    "To optimize performance in Unreal Engine, consider using distance fields for ambient occlusion and reflections.",
    "Nanite virtualized geometry allows for film-quality source art to be used directly in games without traditional baking.",
    "Global illumination is a key component of realistic rendering, and Lumen provides a dynamic solution for it.",
    "Ray tracing can be expensive, but Lumen's hybrid approach balances quality and performance for real-time applications.",
    "The editor provides various tools for profiling and optimizing your game's performance on different target platforms."
  ];

  test("original wordJaccard performance", () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      for (let j = 0; j < passages.length; j++) {
        for (let k = j + 1; k < passages.length; k++) {
          wordJaccard(passages[j], passages[k]);
        }
      }
    }
    const end = performance.now();
    console.log(`Original wordJaccard: ${end - start}ms`);
  });

  test("optimized wordJaccardFromSets performance", () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const sets = passages.map(getWordSet);
      for (let j = 0; j < sets.length; j++) {
        for (let k = j + 1; k < sets.length; k++) {
          wordJaccardFromSets(sets[j], sets[k]);
        }
      }
    }
    const end = performance.now();
    console.log(`Optimized wordJaccardFromSets: ${end - start}ms`);
  });
});
