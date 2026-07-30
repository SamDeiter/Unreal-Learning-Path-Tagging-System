import { describe, it, expect } from "vitest";
import { stemMatch as cachedStemMatch } from "../stemmer";

// Original, un-cached implementation for comparison
function originalStem(word) {
  return word
    .replace(/ies$/i, "y")
    .replace(/ves$/i, "f")
    .replace(/(s|es|ing|ed|tion|ment)$/i, "")
    .toLowerCase();
}

function originalStemMatch(a, b) {
  const aStems = a.split(/[\s_-]+/).filter(w => w.length > 2).map(originalStem);
  const bStems = b.split(/[\s_-]+/).filter(w => w.length > 2).map(originalStem);
  return aStems.some(as => bStems.some(bs => as === bs || as.includes(bs) || bs.includes(as)));
}

describe("Stemmer Performance Benchmark", () => {
  it("compares original vs cached stemmer", () => {
    // Generate some mock words and sentences mimicking a docs search
    const topics = ["lumen", "lighting", "mesh", "materials", "optimization", "post-processing", "blueprint", "rendering"];
    const documentFields = [
      "Introduction to Lumen Global Illumination in Unreal Engine 5",
      "Using Nanite Virtualized Geometry with Static Meshes",
      "Setting up Materials and Textures for high performance rendering",
      "Post-process volume settings and grading tutorial",
      "Blueprints visual scripting basics for beginners",
      "Optimizing lighting and shadow maps for mobile platforms"
    ];

    const iterations = 2000;

    // Measure original
    const startOriginal = performance.now();
    let originalMatches = 0;
    for (let i = 0; i < iterations; i++) {
      for (const topic of topics) {
        for (const doc of documentFields) {
          if (originalStemMatch(topic, doc)) {
            originalMatches++;
          }
        }
      }
    }
    const durationOriginal = performance.now() - startOriginal;

    // Measure cached
    const startCached = performance.now();
    let cachedMatches = 0;
    for (let i = 0; i < iterations; i++) {
      for (const topic of topics) {
        for (const doc of documentFields) {
          if (cachedStemMatch(topic, doc)) {
            cachedMatches++;
          }
        }
      }
    }
    const durationCached = performance.now() - startCached;

    expect(cachedMatches).toBe(originalMatches);

    const speedup = durationOriginal / durationCached;
    console.log(`\n⚡ Benchmark Results (${iterations} iterations):`);
    console.log(`Original un-cached: ${durationOriginal.toFixed(2)}ms`);
    console.log(`Optimized cached  : ${durationCached.toFixed(2)}ms`);
    console.log(`Speedup           : ${speedup.toFixed(2)}x\n`);

    expect(cachedMatches).toBe(originalMatches);
  });
});
