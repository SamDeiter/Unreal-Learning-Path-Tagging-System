import { describe, test, expect } from "vitest";
import { wordJaccard, getWordSet, wordJaccardFromSets } from "../textSimilarity";

// Recreate the old Jaccard implementation for exact performance comparison
function oldWordJaccard(textA, textB) {
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

// Recreate the old deduplication algorithm loop
function oldSemanticDedup(passages) {
  const deduped = [];
  for (const p of passages) {
    const isDupe = deduped.some(
      (kept) => oldWordJaccard(kept.text || "", p.text || "") > 0.7
    );
    if (!isDupe) deduped.push(p);
  }
  return deduped;
}

// Optimized deduplication algorithm loop
function newSemanticDedup(passages) {
  const wordSets = new Map();
  for (const p of passages) {
    wordSets.set(p, getWordSet(p.text));
  }

  const deduped = [];
  for (const p of passages) {
    const pSet = wordSets.get(p);
    const isDupe = deduped.some((kept) => {
      const keptSet = wordSets.get(kept);
      return wordJaccardFromSets(keptSet, pSet) > 0.7;
    });
    if (!isDupe) deduped.push(p);
  }
  return deduped;
}

describe("textSimilarity Performance Benchmark", () => {
  test("compares single-call Jaccard performance", () => {
    const textA = "Lumen enables real-time global illumination and reflections in Unreal Engine";
    const textB = "Lumen enables real-time global illumination and reflections in Unreal Engine scenes";

    // Warm-up
    for (let i = 0; i < 100; i++) {
      oldWordJaccard(textA, textB);
      wordJaccard(textA, textB);
    }

    const iterations = 5000;

    const startOld = performance.now();
    for (let i = 0; i < iterations; i++) {
      oldWordJaccard(textA, textB);
    }
    const endOld = performance.now();
    const oldDuration = endOld - startOld;

    const startNew = performance.now();
    for (let i = 0; i < iterations; i++) {
      wordJaccard(textA, textB);
    }
    const endNew = performance.now();
    const newDuration = endNew - startNew;

    const speedup = oldDuration / newDuration;

    console.log(`\n⚡ [Single-Call Jaccard Benchmark]`);
    console.log(`   Old wordJaccard: ${oldDuration.toFixed(3)}ms`);
    console.log(`   New wordJaccard: ${newDuration.toFixed(3)}ms`);
    console.log(`   Speedup: ${speedup.toFixed(2)}x faster\n`);

    expect(wordJaccard(textA, textB)).toBeCloseTo(oldWordJaccard(textA, textB), 5);
  });

  test("compares deduplication of 120 passages", () => {
    // Generate 120 mock passages (including duplicates/near-duplicates to simulate realistic search pipeline output)
    const templates = [
      "Lumen enables real-time global illumination and reflections in Unreal Engine",
      "Virtual shadow maps work with Nanite to provide detailed shadow rendering",
      "Setting up Nanite for static meshes requires enabling the plugin",
      "We store our bulk data in virtual assets where they are set up",
      "Blueprint scripting is extremely fast and modular in UE5",
      "Metasounds introduces high performance programmable audio sources",
    ];

    const passages = [];
    for (let i = 0; i < 120; i++) {
      const template = templates[i % templates.length];
      // Introduce slight variations to simulate search results
      const text = i % 5 === 0
        ? `${template} with additional context variation number ${i}`
        : template;
      passages.push({ id: `p_${i}`, text });
    }

    // Warm-up
    oldSemanticDedup(passages);
    newSemanticDedup(passages);

    const startOld = performance.now();
    const oldResult = oldSemanticDedup(passages);
    const oldDuration = performance.now() - startOld;

    const startNew = performance.now();
    const newResult = newSemanticDedup(passages);
    const newDuration = performance.now() - startNew;

    const speedup = oldDuration / newDuration;

    console.log(`\n⚡ [120 Passages Deduplication Benchmark]`);
    console.log(`   Old Dedup (Jaccard on text split in O(N^2) loop): ${oldDuration.toFixed(3)}ms`);
    console.log(`   New Dedup (Pre-calculated Sets & Inclusion-Exclusion): ${newDuration.toFixed(3)}ms`);
    console.log(`   Speedup: ${speedup.toFixed(2)}x faster\n`);

    expect(newResult.length).toBe(oldResult.length);
    // Ensure correctness of deduplication
    expect(newResult.map(p => p.id)).toEqual(oldResult.map(p => p.id));
    // Verify we hit a meaningful optimization target
    expect(speedup).toBeGreaterThan(1.5);
  });
});
