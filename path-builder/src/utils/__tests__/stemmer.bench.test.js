import { describe, it, expect } from "vitest";
import { stemMatch } from "../stemmer";

describe("Stemmer Performance Benchmark", () => {
  it("completes stem match iterations rapidly due to caching", () => {
    const start = performance.now();

    // Simulate matching typical doc search attributes
    const topic = "lighting";
    const documents = [
      "lumen global illumination and lighting",
      "nanite virtualized geometry and static meshes",
      "post processing and color grading",
      "shadow maps and virtual shadow maps",
      "material editor and node graph textures",
    ];

    // Run many iterations to simulate multiple searches or massive doc collection
    const iterations = 5000;
    let matchCount = 0;
    for (let i = 0; i < iterations; i++) {
      for (const doc of documents) {
        if (stemMatch(topic, doc)) {
          matchCount++;
        }
      }
    }

    const duration = performance.now() - start;
    console.log(`[Benchmark] ${iterations * documents.length} stemMatch operations took ${duration.toFixed(2)}ms`);

    expect(duration).toBeLessThan(150); // Usually takes <10ms with cache
    expect(matchCount).toBe(iterations); // 1 match per document list loop ("lighting" in first document)
  });
});
