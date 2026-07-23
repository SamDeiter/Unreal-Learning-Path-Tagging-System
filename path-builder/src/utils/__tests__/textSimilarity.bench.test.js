import { describe, test, expect } from "vitest";
import { wordJaccard, getWordSet, wordJaccardFromSets } from "../textSimilarity";

// Old slow implementation of wordJaccard for side-by-side comparison
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

// Old slow semantic deduplication logic
function oldSemanticDedup(retrievedPassages) {
  const semanticDeduped = [];
  for (const p of retrievedPassages) {
    const isDupe = semanticDeduped.some(
      (kept) => oldWordJaccard(kept.text || "", p.text || "") > 0.7
    );
    if (!isDupe) semanticDeduped.push(p);
  }
  return semanticDeduped;
}

// New optimized semantic deduplication logic
function newSemanticDedup(retrievedPassages) {
  const semanticDeduped = [];
  const wordSets = new Map();

  for (let i = 0; i < retrievedPassages.length; i++) {
    const p = retrievedPassages[i];
    wordSets.set(p, getWordSet(p.text || ""));
  }

  for (let i = 0; i < retrievedPassages.length; i++) {
    const p = retrievedPassages[i];
    const setP = wordSets.get(p);
    let isDupe = false;
    for (let j = 0; j < semanticDeduped.length; j++) {
      const kept = semanticDeduped[j];
      if (wordJaccardFromSets(wordSets.get(kept), setP) > 0.7) {
        isDupe = true;
        break;
      }
    }
    if (!isDupe) {
      semanticDeduped.push(p);
    }
  }
  return semanticDeduped;
}

describe("textSimilarity Benchmark", () => {
  test("optimized functions match old output exactly", () => {
    const sampleA = "Lumen enables real-time global illumination and reflections in Unreal Engine";
    const sampleB = "Lumen enables real-time global illumination and reflections in Unreal Engine scenes";
    expect(wordJaccard(sampleA, sampleB)).toBe(oldWordJaccard(sampleA, sampleB));

    const sampleC = "Setting up Nanite for static meshes requires enabling the plugin";
    const sampleD = "Virtual shadow maps work with Nanite to provide detailed shadow rendering";
    expect(wordJaccard(sampleC, sampleD)).toBe(oldWordJaccard(sampleC, sampleD));
  });

  test("deduplication outputs match exactly", () => {
    // Construct test cases with some duplicates
    const passages = [
      { text: "Lumen enables real-time global illumination" },
      { text: "Lumen enables real-time global illumination and reflection" }, // near dupe
      { text: "Setting up Nanite for static meshes requires enabling the plugin" },
      { text: "Virtual shadow maps work with Nanite" },
      { text: "Lumen enables real-time global illumination" }, // exact dupe
    ];

    const oldResult = oldSemanticDedup(passages);
    const newResult = newSemanticDedup(passages);

    expect(newResult.length).toBe(oldResult.length);
    for (let i = 0; i < oldResult.length; i++) {
      expect(newResult[i].text).toBe(oldResult[i].text);
    }
  });

  test("benchmark performance difference with 120 passages", () => {
    // Generate 120 mock passages
    const words = ["lumen", "nanite", "unreal", "engine", "global", "illumination", "shadow", "maps", "rendering", "plugin", "editor", "blueprint", "materials", "niagara", "particles", "physics", "simulation", "performance", "optimization", "shading"];
    const retrievedPassages = [];
    for (let i = 0; i < 120; i++) {
      // Pick 8 random words to form a passage
      const phraseWords = [];
      for (let j = 0; j < 8; j++) {
        const randWord = words[Math.floor(Math.random() * words.length)] + (Math.random() > 0.85 ? "s" : "");
        phraseWords.push(randWord);
      }
      retrievedPassages.push({ text: phraseWords.join(" ") });
    }

    // Warm up
    for (let i = 0; i < 5; i++) {
      oldSemanticDedup(retrievedPassages);
      newSemanticDedup(retrievedPassages);
    }

    // Measure old implementation
    const oldStart = performance.now();
    const ITERATIONS = 15;
    for (let i = 0; i < ITERATIONS; i++) {
      oldSemanticDedup(retrievedPassages);
    }
    const oldEnd = performance.now();
    const oldDuration = (oldEnd - oldStart) / ITERATIONS;

    // Measure new implementation
    const newStart = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      newSemanticDedup(retrievedPassages);
    }
    const newEnd = performance.now();
    const newDuration = (newEnd - newStart) / ITERATIONS;

    const speedup = oldDuration / newDuration;
    console.log(`\n=================== BENCHMARK RESULTS ===================`);
    console.log(`Old Semantic Dedup Mean Latency: ${oldDuration.toFixed(2)}ms`);
    console.log(`New Semantic Dedup Mean Latency: ${newDuration.toFixed(2)}ms`);
    console.log(`Speedup factor: ${speedup.toFixed(2)}x`);
    console.log(`==========================================================\n`);

    expect(newDuration).toBeLessThan(oldDuration);
  });
});
