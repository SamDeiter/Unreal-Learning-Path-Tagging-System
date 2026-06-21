import { describe, bench } from "vitest";
import tagGraphService from "../TagGraphService";

describe("TagGraphService benchmarks", () => {
  const query = "I am having trouble with lumen and nanite in my blueprint project. The shadows look weird with virtual shadow maps.";
  const course = {
    canonical_tags: ["rendering.lumen", "rendering.nanite"],
    ai_tags: ["blueprints", "vsm"]
  };
  const targetTagIds = ["rendering.lumen", "rendering.nanite", "blueprints", "rendering.vsm"];

  bench("extractTagsFromText", () => {
    tagGraphService.extractTagsFromText(query);
  });

  bench("scoreCourseRelevance", () => {
    tagGraphService.scoreCourseRelevance(course, targetTagIds);
  });
});
