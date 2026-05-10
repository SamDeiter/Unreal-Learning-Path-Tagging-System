
import { describe, it, bench } from 'vitest';
import tagGraphService from '../TagGraphService';
import library from '../../data/video_library.json';

// Mock course data if library is empty or missing
const courses = library?.courses || [
  {
    code: 'test-1',
    canonical_tags: ['rendering.lumen', 'lighting.dynamic'],
    gemini_system_tags: ['vfx.niagara']
  },
  {
    code: 'test-2',
    canonical_tags: ['scripting.blueprint', 'ui.umg'],
  }
];

const targetTags = ['rendering.lumen', 'vfx.niagara', 'scripting.blueprint'];

describe('TagGraphService Performance', () => {
  it('measures scoreCourseRelevance performance', () => {
    const start = performance.now();
    const iterations = 1; // We can increase this to see the impact

    for (let i = 0; i < iterations; i++) {
      courses.forEach(course => {
        tagGraphService.scoreCourseRelevance(course, targetTags);
      });
    }

    const end = performance.now();
    const duration = end - start;
    console.log(`Scored ${courses.length} courses in ${duration.toFixed(2)}ms`);
    console.log(`Average time per course: ${(duration / courses.length).toFixed(4)}ms`);
  });

  bench('scoreCourseRelevance benchmark (batch of 100)', () => {
    // Use a subset of 100 courses if available, otherwise repeat existing ones
    const batch = [];
    for (let i = 0; i < 100; i++) {
      batch.push(courses[i % courses.length]);
    }

    batch.forEach(course => {
      tagGraphService.scoreCourseRelevance(course, targetTags);
    });
  }, { iterations: 100 });
});
