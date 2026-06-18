import { bench, describe } from "vitest";
import tagGraphService from "../TagGraphService";

describe("TagGraphService Performance", () => {
  const mockCourse = {
    code: "100.01",
    title: "Introduction to Unreal Engine",
    canonical_tags: [
      "scripting.blueprint",
      "rendering.lumen",
      "rendering.nanite",
      "environment.landscape",
    ],
    ai_tags: ["editor", "blueprint", "lumen"],
    gemini_system_tags: ["lighting", "nanite"],
  };

  const targetTagIds = [
    "scripting.blueprint",
    "rendering.lumen",
    "rendering.lighting",
    "ui.umg",
  ];

  const sampleQueries = [
    "How do I use blueprints for lumen lighting?",
    "I need help with Niagara VFX and Chaos physics, but not C++",
    "What is the best way to handle world partition and landscape in UE5?",
    "BP compilation error in sequencer while using virtual shadow maps",
  ];

  bench("scoreCourseRelevance - single call", () => {
    tagGraphService.scoreCourseRelevance(mockCourse, targetTagIds);
  });

  bench("scoreCourseRelevance - batch (500 courses)", () => {
    for (let i = 0; i < 500; i++) {
      tagGraphService.scoreCourseRelevance(mockCourse, targetTagIds);
    }
  });

  bench("extractTagsFromText", () => {
    for (const query of sampleQueries) {
      tagGraphService.extractTagsFromText(query);
    }
  });
});
