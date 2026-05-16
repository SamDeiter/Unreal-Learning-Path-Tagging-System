
import { describe, it } from "vitest";
import tagGraphService from "../TagGraphService";
import library from "../../../../content/video_library_enriched.json";

describe("TagGraphService Performance Benchmark", () => {
  it("benchmarks scoreCourseRelevance batch processing", () => {
    const courses = library.courses; // Full library
    const targetTagIds = ["scripting.blueprints", "rendering.lumen", "animation.sequencer"];

    console.log(`Benchmarking ${courses.length} courses...`);

    const start = performance.now();
    for (const course of courses) {
      tagGraphService.scoreCourseRelevance(course, targetTagIds);
    }
    const end = performance.now();

    console.log(`Batch processing ${courses.length} courses took ${end - start}ms`);
  });
});
