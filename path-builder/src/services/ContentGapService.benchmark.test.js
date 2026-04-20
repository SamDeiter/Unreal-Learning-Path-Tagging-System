import { describe, it } from "vitest";
import { analyzeGaps, getRelevanceBadge } from "./ContentGapService";
import { makeCourse } from "../__tests__/fixtures/testCourses";

describe("ContentGapService Benchmark", () => {
  // Generate a large number of courses for benchmarking
  const largeCourseSet = [];
  for (let i = 0; i < 2500; i++) {
    largeCourseSet.push(
      makeCourse({
        code: `COURSE.${i}`,
        title: `Course Title ${i} with some keywords like animation and blueprint`,
        canonical_tags: ["animation", "blueprint", "sequencer"],
        ai_tags: ["vfx", "niagara"],
        transcript_tags: ["c++", "networking"],
      })
    );
  }

  const personaId = "animator_alex";

  it("benchmarks getRelevanceBadge (Repeated Calls)", () => {
    // Warm up cache
    for (const course of largeCourseSet) {
      getRelevanceBadge(course, personaId);
    }

    const start = performance.now();
    for (const course of largeCourseSet) {
      getRelevanceBadge(course, personaId);
    }
    const end = performance.now();
    console.log(`getRelevanceBadge (Cached - 2500 courses): ${(end - start).toFixed(2)}ms`);
  });

  it("benchmarks analyzeGaps (Repeated Calls)", () => {
    // Warm up cache
    analyzeGaps(personaId, largeCourseSet, []);

    const start = performance.now();
    analyzeGaps(personaId, largeCourseSet, []);
    const end = performance.now();
    console.log(`analyzeGaps (Cached - 2500 courses): ${(end - start).toFixed(2)}ms`);
  });
});
