import { describe, it, expect, vi } from "vitest";
import { analyzeGaps, getRelevanceBadge } from "../ContentGapService";
import { allCourses, makeCourse } from "../../__tests__/fixtures/testCourses";

describe("ContentGapService Benchmark", () => {
  const largeCatalog = Array.from({ length: 2000 }, (_, i) =>
    makeCourse({
      code: `BENCH.${i}`,
      title: `Course Title ${i} with some extra text to make it realistic`,
      canonical_tags: ["tag1", "tag2", "tag3"],
      ai_tags: ["ai-tag-1", "ai-tag-2"],
      transcript_tags: ["transcript-tag-1"],
    })
  );

  it("measures performance of analyzeGaps with 2000 courses", () => {
    const start = performance.now();
    const iterations = 5;

    for (let i = 0; i < iterations; i++) {
      analyzeGaps("animator_alex", largeCatalog, []);
    }

    const end = performance.now();
    const avgTime = (end - start) / iterations;

    console.log(`[BENCHMARK] analyzeGaps average time: ${avgTime.toFixed(2)}ms`);
    expect(avgTime).toBeLessThan(100); // Sanity check
  });

  it("measures performance of getRelevanceBadge with 2000 calls", () => {
    const start = performance.now();

    largeCatalog.forEach(course => {
      getRelevanceBadge(course, "animator_alex");
    });

    const end = performance.now();
    const totalTime = end - start;

    console.log(`[BENCHMARK] getRelevanceBadge total time (2000 calls): ${totalTime.toFixed(2)}ms`);
    expect(totalTime).toBeLessThan(100); // Sanity check
  });
});
