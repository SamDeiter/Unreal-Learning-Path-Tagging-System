import { bench, describe } from 'vitest';
import tagGraphService from '../TagGraphService';

const sampleTexts = [
  "How do I use Lumen in Unreal Engine 5?",
  "Blueprint compilation error in my project",
  "I want to learn about Niagara and VFX",
  "Global illumination without ray tracing",
  "Nanite performance issues on mobile",
];

describe('TagGraphService.extractTagsFromText', () => {
  bench('extractTagsFromText', () => {
    for (const text of sampleTexts) {
      tagGraphService.extractTagsFromText(text);
    }
  });
});

const mockCourse = {
    code: "TEST-101",
    canonical_tags: ["rendering.lumen", "rendering.lighting"],
    gemini_system_tags: ["lumen", "lighting"],
};
const targetTags = ["rendering.lumen", "rendering.nanite", "lighting.global_illumination"];

describe('TagGraphService.scoreCourseRelevance', () => {
  bench('scoreCourseRelevance', () => {
    tagGraphService.scoreCourseRelevance(mockCourse, targetTags);
  });
});
