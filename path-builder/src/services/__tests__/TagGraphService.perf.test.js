
import { describe, it } from 'vitest';
import tagGraphService from '../TagGraphService';
import library from '../../data/video_library_enriched.json' with { type: 'json' };

describe('TagGraphService Performance Benchmark', () => {
  it('benchmarks scoreCourseRelevance', () => {
    const allCourses = library.courses;
    const targetTagIds = ["rendering.lumen", "rendering.nanite", "lighting.dynamic", "materials.pbr"];

    console.log(`Benchmarking ${allCourses.length} courses with ${targetTagIds.length} target tags...`);

    const start = performance.now();
    for (const course of allCourses) {
      tagGraphService.scoreCourseRelevance(course, targetTagIds);
    }
    const end = performance.now();

    console.log(`Total time: ${(end - start).toFixed(2)}ms`);
    console.log(`Average time per course: ${((end - start) / allCourses.length).toFixed(4)}ms`);
  });
});
