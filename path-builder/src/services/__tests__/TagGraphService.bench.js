import { describe, it, expect, bench } from "vitest";
import tagGraphService from "../TagGraphService";

describe("TagGraphService Benchmark", () => {
  const mockCourses = [];
  for (let i = 0; i < 500; i++) {
    mockCourses.push({
      code: `course_${i}`,
      canonical_tags: ['rendering.lumen', 'scripting.blueprint'],
      ai_tags: ['lighting'],
      gemini_system_tags: ['lumen']
    });
  }
  const targetTagIds = ['rendering.lumen', 'scripting.blueprint', 'worldbuilding.landscape'];

  bench("scoreCourseRelevance for 500 courses", () => {
    for (const course of mockCourses) {
      tagGraphService.scoreCourseRelevance(course, targetTagIds);
    }
  });

  bench("extractTagsFromText", () => {
    tagGraphService.extractTagsFromText('I want to learn about lumen and blueprint scripting for lighting');
  });
});
