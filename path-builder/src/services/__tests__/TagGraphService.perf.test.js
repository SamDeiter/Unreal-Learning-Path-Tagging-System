
import { describe, it } from "vitest";
import { TagGraphService } from "../TagGraphService.js";
import library from "../../data/video_library_enriched.json";

describe("TagGraphService Performance Benchmark", () => {
  it("benchmarks scoreCourseRelevance", () => {
    const tgs = new TagGraphService();
    // Assuming library is { courses: [...] } based on head output
    const courses = library.courses || [];
    const targetTagIds = [
        "rendering.lumen", "scripting.blueprint", "lighting.dynamic",
        "worldbuilding.worldPartition", "ai.navigation", "physics.chaos",
        "ui.umg", "networking.multiplayer", "animation.sequencer", "materials.nanite"
    ];

    console.log(`\n[Benchmark] courses: ${courses.length}, targetTags: ${targetTagIds.length}`);

    if (courses.length === 0) {
        console.warn("No courses found for benchmark!");
        return;
    }

    const iterations = 3;
    let totalDuration = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      let TOTAL_SCORE = 0;
      for (const course of courses) {
        const result = tgs.scoreCourseRelevance(course, targetTagIds);
        TOTAL_SCORE += result.score;
      }
      const end = performance.now();
      totalDuration += (end - start);
      // Use TOTAL_SCORE to avoid it being optimized away if that ever happens
      if (TOTAL_SCORE === -1) console.log("impossible");
    }

    const avgDuration = totalDuration / iterations;
    console.log(`[Benchmark] Average Total duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`[Benchmark] Average per course: ${(avgDuration / courses.length).toFixed(4)}ms`);
  });
});
