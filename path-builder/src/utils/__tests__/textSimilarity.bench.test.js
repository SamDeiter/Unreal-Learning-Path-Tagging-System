import { describe, test, expect } from "vitest";
import { getWordSet, wordJaccardFromSets } from "../textSimilarity";

// Inline implementation of the legacy wordJaccard function for benchmark comparison
function legacyWordJaccard(textA, textB) {
  const wordsA = new Set(
    (textA || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
  const wordsB = new Set(
    (textB || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );

  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

describe("textSimilarity Performance Benchmark", () => {
  test("measure speedup of optimized Jaccard & semantic deduplication", () => {
    // Generate 120 mock passages with varying length and semantic overlap
    const templates = [
      "Lumen enables real-time global illumination and reflections in Unreal Engine scenes",
      "Nanite virtualized geometry allows extremely high polygon counts without performance hit",
      "Virtual shadow maps work with Nanite to provide high-detail shadow rendering",
      "Using the Niagara fluid simulation tool for realistic smoke and water effects",
      "Setting up a basic first person character with enhanced input system mapping",
      "Troubleshooting lighting seams and lightmap resolution issues on static meshes",
      "How to configure World Partition in Unreal Engine 5 for large open world levels",
      "Creating highly detailed landscape materials with runtime virtual textures RVT",
    ];

    const passages = [];
    for (let i = 0; i < 120; i++) {
      const base = templates[i % templates.length];
      const noise = ` random noise token segment number ${i} with extra padding and content`;
      passages.push({
        id: i,
        text: base + noise,
      });
    }

    // 1. Run Benchmark on Legacy wordJaccard
    const legacyStart = performance.now();
    const legacyDeduped = [];
    for (const p of passages) {
      const isDupe = legacyDeduped.some(
        (kept) => legacyWordJaccard(kept.text || "", p.text || "") > 0.7
      );
      if (!isDupe) legacyDeduped.push(p);
    }
    const legacyDuration = performance.now() - legacyStart;

    // 2. Run Benchmark on Optimized wordJaccard with pre-calculated word sets and Inclusion-Exclusion
    const optimizedStart = performance.now();
    const wordSets = new Map();
    for (let i = 0; i < passages.length; i++) {
      const p = passages[i];
      wordSets.set(p, getWordSet(p.text || ""));
    }

    const optimizedDeduped = [];
    for (let i = 0; i < passages.length; i++) {
      const p = passages[i];
      const pSet = wordSets.get(p);
      const isDupe = optimizedDeduped.some(
        (kept) => wordJaccardFromSets(wordSets.get(kept), pSet) > 0.7
      );
      if (!isDupe) optimizedDeduped.push(p);
    }
    const optimizedDuration = performance.now() - optimizedStart;

    // Assert that the final results are identical to guarantee correctness
    expect(optimizedDeduped.length).toBe(legacyDeduped.length);
    for (let i = 0; i < optimizedDeduped.length; i++) {
      expect(optimizedDeduped[i].id).toBe(legacyDeduped[i].id);
    }

    const speedup = legacyDuration / optimizedDuration;

    console.log("--------------------------------------------------");
    console.log(`🚀 Text Similarity Benchmark Results (N = ${passages.length} passages):`);
    console.log(`  - Legacy Deduplication Time : ${legacyDuration.toFixed(2)} ms`);
    console.log(`  - Optimized Deduplication Time: ${optimizedDuration.toFixed(2)} ms`);
    console.log(`  - Speedup Factor              : ${speedup.toFixed(2)}x`);
    console.log("--------------------------------------------------");

    // Expect a significant performance improvement (at least 2x)
    expect(speedup).toBeGreaterThan(2);
  });
});
