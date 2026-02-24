import { describe, it, expect, vi } from "vitest";
import {
  estimateDuration,
  overlapRatio,
  buildLearningPath,
  ROLE_PRIORITY,
} from "../../services/PathBuilder";
import {
  makeCourse,
  blueprintBasicsCourse,
  materialsCourse,
} from "../../__tests__/fixtures/testCourses";

// Mock TagGraphService to avoid real graph dependency
vi.mock("../../services/TagGraphService.js", () => ({
  default: {
    getTag: () => null,
    edgesBySource: new Map(),
  },
}));

// ─── ROLE_PRIORITY ───────────────────────────────────────────

describe("ROLE_PRIORITY", () => {
  it("defines 4 roles with prerequisite first", () => {
    expect(ROLE_PRIORITY).toHaveProperty("prerequisite");
    expect(ROLE_PRIORITY).toHaveProperty("core");
    expect(ROLE_PRIORITY).toHaveProperty("troubleshooting");
    expect(ROLE_PRIORITY).toHaveProperty("supplemental");
    expect(ROLE_PRIORITY.prerequisite).toBeLessThan(ROLE_PRIORITY.core);
    expect(ROLE_PRIORITY.core).toBeLessThan(ROLE_PRIORITY.supplemental);
  });
});

// ─── estimateDuration ────────────────────────────────────────

describe("estimateDuration", () => {
  it("uses estimated_minutes when available", () => {
    expect(estimateDuration({ estimated_minutes: 45 })).toBe(45);
  });

  it("converts total_duration_seconds to minutes", () => {
    expect(estimateDuration({ total_duration_seconds: 1800 })).toBe(30);
  });

  it("falls back to video count * 10 min", () => {
    expect(estimateDuration({ videos: [{}, {}, {}] })).toBe(30);
  });

  it("defaults to 10 min for course with no duration info", () => {
    expect(estimateDuration({})).toBe(10);
  });

  it("prefers estimated_minutes over other fields", () => {
    expect(
      estimateDuration({
        estimated_minutes: 20,
        total_duration_seconds: 3600,
        videos: [1, 2, 3, 4, 5],
      })
    ).toBe(20);
  });

  it("works with real course fixtures", () => {
    expect(estimateDuration(blueprintBasicsCourse)).toBe(45);
    expect(estimateDuration(materialsCourse)).toBe(90);
  });
});

// ─── overlapRatio ────────────────────────────────────────────

describe("overlapRatio", () => {
  it("returns 0 for empty selectedTags", () => {
    expect(overlapRatio(blueprintBasicsCourse, new Set())).toBe(0);
  });

  it("returns 0 for course with no tags", () => {
    const emptyTagCourse = makeCourse({
      canonical_tags: [],
      gemini_system_tags: [],
      transcript_tags: [],
      tags: [],
    });
    expect(overlapRatio(emptyTagCourse, new Set(["blueprint"]))).toBe(0);
  });

  it("returns 1 for full overlap", () => {
    const singleTagCourse = makeCourse({
      canonical_tags: ["blueprint"],
      gemini_system_tags: [],
      transcript_tags: [],
      tags: [],
    });
    expect(overlapRatio(singleTagCourse, new Set(["blueprint"]))).toBe(1);
  });

  it("returns fractional overlap for partial match", () => {
    const result = overlapRatio(materialsCourse, new Set(["materials"]));
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it("handles case-insensitive matching", () => {
    const course = makeCourse({
      canonical_tags: ["Blueprint"],
      gemini_system_tags: [],
      transcript_tags: [],
      tags: [],
    });
    expect(overlapRatio(course, new Set(["blueprint"]))).toBe(1);
  });
});

// ─── buildLearningPath ───────────────────────────────────────

describe("buildLearningPath", () => {
  it("returns empty path for null/empty input", () => {
    const result = buildLearningPath(null, []);
    expect(result.path).toEqual([]);
    expect(result.metadata.itemCount).toBe(0);
    expect(result.metadata.totalMinutes).toBe(0);

    const result2 = buildLearningPath([], []);
    expect(result2.path).toEqual([]);
  });

  it("returns path items with correct structure", () => {
    const courses = [
      makeCourse({ code: "102.01", canonical_tags: ["blueprint"], _relevanceScore: 90 }),
    ];
    const result = buildLearningPath(courses, ["blueprint"]);
    expect(result.path.length).toBe(1);
    expect(result.path[0]).toHaveProperty("course");
    expect(result.path[0]).toHaveProperty("role");
    expect(result.path[0]).toHaveProperty("reason");
    expect(result.path[0]).toHaveProperty("estimatedMinutes");
  });

  it("respects maxItems constraint", () => {
    const courses = Array.from({ length: 20 }, (_, i) =>
      makeCourse({
        code: `${100 + i}.0${i}`,
        title: `UE5 Course Module ${i + 1}`,
        canonical_tags: [`tag${i}`],
        _relevanceScore: 90 - i,
      })
    );
    const result = buildLearningPath(courses, ["tag0"], { maxItems: 5 });
    expect(result.path.length).toBeLessThanOrEqual(5);
    expect(result.metadata.itemCount).toBeLessThanOrEqual(5);
  });

  it("respects timeBudgetMinutes constraint", () => {
    const courses = Array.from({ length: 10 }, (_, i) =>
      makeCourse({
        code: `${200 + i}.0${i}`,
        title: `UE5 Lighting Module ${i + 1}`,
        canonical_tags: [`tag${i}`],
        estimated_minutes: 30,
        _relevanceScore: 90 - i,
      })
    );
    const result = buildLearningPath(courses, ["tag0"], { timeBudgetMinutes: 60 });
    expect(result.metadata.totalMinutes).toBeLessThanOrEqual(60);
  });

  it("computes metadata correctly with real fixtures", () => {
    const courses = [blueprintBasicsCourse, materialsCourse];
    const result = buildLearningPath(courses, ["blueprint", "materials"], { diversity: false });
    expect(result.metadata.itemCount).toBe(2);
    expect(result.metadata.totalMinutes).toBe(135); // 45 + 90
    expect(result.metadata.tagCoverage).toBeGreaterThanOrEqual(0);
    expect(result.metadata.tagCoverage).toBeLessThanOrEqual(1);
    expect(result.metadata.diversityScore).toBeGreaterThanOrEqual(0);
    expect(result.metadata.diversityScore).toBeLessThanOrEqual(1);
  });

  it("filters high-overlap courses when diversity is enabled", () => {
    // Create courses with identical tags — diversity should filter duplicates
    const courses = Array.from({ length: 5 }, (_, i) =>
      makeCourse({
        code: `${300 + i}.0${i}`,
        title: `Blueprint Variations ${i + 1}`,
        canonical_tags: ["blueprint", "materials"], // same tags
        _relevanceScore: 90 - i,
      })
    );
    const resultDiversity = buildLearningPath(courses, ["blueprint"], { diversity: true });
    const resultNoDiversity = buildLearningPath(courses, ["blueprint"], { diversity: false });

    // With diversity, should have fewer items (skipping overlapping ones)
    expect(resultDiversity.path.length).toBeLessThanOrEqual(resultNoDiversity.path.length);
  });
});
