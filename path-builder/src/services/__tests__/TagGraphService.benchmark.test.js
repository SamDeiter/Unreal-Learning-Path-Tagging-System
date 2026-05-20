
import { describe, it } from "vitest";
import tagGraphService from "../TagGraphService";
import library from "../../data/video_library_enriched.json";

describe("TagGraphService Benchmark", () => {
  it("benchmarks scoreCourseRelevance", () => {
    const courses = library.courses;
    const sampleQueryTags = ["rendering.lumen", "materials.shaders", "scripting.blueprints"];

    console.log(`Benchmarking scoreCourseRelevance with ${courses.length} courses and ${sampleQueryTags.length} query tags...`);

    // Warm up
    for (let i = 0; i < 10; i++) {
      tagGraphService.scoreCourseRelevance(courses[i], sampleQueryTags);
    }

    const start = performance.now();
    for (const course of courses) {
      tagGraphService.scoreCourseRelevance(course, sampleQueryTags);
    }
    const end = performance.now();

    console.log(`Total time for ${courses.length} courses: ${(end - start).toFixed(2)}ms`);
    console.log(`Average time per course: ${((end - start) / courses.length).toFixed(4)}ms`);
  });
});
