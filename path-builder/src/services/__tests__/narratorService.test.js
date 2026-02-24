/**
 * Unit tests for narratorService
 */
import { describe, it, expect } from "vitest";
import { generatePathIntro, generateBridgeText, generateProgressText } from "../narratorService";
import {
  sequencerCourse,
  cppGameplayCourse,
  materialsCourse,
} from "../../__tests__/fixtures/testCourses";

// ── Helper: add instructor field to fixture ──────────────────────────────
const withInstructor = (course, instructor) => ({ ...course, instructor });

const alexCourse = withInstructor(sequencerCourse, "Alex");
const bobCourse = withInstructor(cppGameplayCourse, "Bob");
const alsoAlexCourse = withInstructor(materialsCourse, "Alex");

// ── generatePathIntro ────────────────────────────────────────────────────
describe("generatePathIntro", () => {
  it("returns defaults when courses is empty", () => {
    const result = generatePathIntro({
      problemSummary: "test",
      courses: [],
      diagnosis: {},
    });
    expect(result.title).toBe("Your Learning Path");
    expect(result.intro).toContain("step by step");
    expect(result.instructors).toEqual([]);
  });

  it("returns defaults when courses is null", () => {
    const result = generatePathIntro({
      problemSummary: "test",
      courses: null,
      diagnosis: null,
    });
    expect(result.title).toBe("Your Learning Path");
  });

  it("attributes a single instructor", () => {
    const result = generatePathIntro({
      problemSummary: "fix lighting",
      courses: [alexCourse],
      diagnosis: {},
    });
    expect(result.intro).toContain("Alex");
    expect(result.instructors).toHaveLength(1);
    expect(result.instructors[0].name).toBe("Alex");
    expect(result.courseCount).toBe(1);
  });

  it("lists multiple instructors grammatically", () => {
    const result = generatePathIntro({
      problemSummary: "blueprints",
      courses: [alexCourse, bobCourse],
      diagnosis: {},
    });
    expect(result.intro).toContain("Alex");
    expect(result.intro).toContain("Bob");
    expect(result.instructors).toHaveLength(2);
  });

  it("deduplicates instructors across courses", () => {
    const result = generatePathIntro({
      problemSummary: "shaders",
      courses: [alexCourse, alsoAlexCourse],
      diagnosis: {},
    });
    expect(result.instructors).toHaveLength(1);
    expect(result.instructors[0].courses).toHaveLength(2);
  });

  it("mentions root cause count when diagnosis has root_causes", () => {
    const result = generatePathIntro({
      problemSummary: "lighting is broken",
      courses: [alexCourse],
      diagnosis: { root_causes: ["bad normals", "missing lightmaps"] },
    });
    expect(result.intro).toContain("2 root causes");
    expect(result.rootCauses).toHaveLength(2);
  });

  it("summarizes long problem text in title", () => {
    const longProblem = "A".repeat(100);
    const result = generatePathIntro({
      problemSummary: longProblem,
      courses: [alexCourse],
      diagnosis: {},
    });
    expect(result.title.length).toBeLessThan(100);
    expect(result.title).toContain("…");
  });

  it("handles courses with video durations", () => {
    const courseWithVideos = {
      ...alexCourse,
      videos: [
        { title: "Part 1", duration_seconds: 600 },
        { title: "Part 2", duration_seconds: 900 },
      ],
    };
    const result = generatePathIntro({
      problemSummary: "learn sequencer",
      courses: [courseWithVideos],
      diagnosis: {},
    });
    expect(result.totalDuration).toBe("25 min");
  });

  it("formats durations as hours when large", () => {
    const courseWithVideos = {
      ...alexCourse,
      videos: [
        { title: "Part 1", duration_seconds: 3600 },
        { title: "Part 2", duration_seconds: 1800 },
      ],
    };
    const result = generatePathIntro({
      problemSummary: "deep dive",
      courses: [courseWithVideos],
      diagnosis: {},
    });
    expect(result.totalDuration).toBe("1 hr 30 min");
  });

  it("handles no-instructor courses with video count", () => {
    const noInstructorCourses = [
      { title: "Course A", videos: [{ title: "v1" }] },
      { title: "Course B", videos: [{ title: "v2" }, { title: "v3" }] },
    ];
    const result = generatePathIntro({
      problemSummary: "test",
      courses: noInstructorCourses,
      diagnosis: {},
    });
    expect(result.intro).toContain("2 lessons");
    expect(result.intro).toContain("3 videos");
  });
});

// ── generateBridgeText ───────────────────────────────────────────────────
describe("generateBridgeText", () => {
  it("returns completion when nextCourse is null", () => {
    const result = generateBridgeText(alexCourse, null, null);
    expect(result.type).toBe("completion");
    expect(result.text).toContain("Congratulations");
  });

  it("returns transition when instructors differ", () => {
    const result = generateBridgeText(alexCourse, bobCourse, "C++ basics");
    expect(result.type).toBe("transition");
    expect(result.text).toContain("Bob");
    expect(result.subtext).toContain("C++ basics");
  });

  it("returns continuation when same instructor", () => {
    const result = generateBridgeText(alexCourse, alsoAlexCourse, "shaders");
    expect(result.type).toBe("continuation");
    expect(result.instructor).toBe("Alex");
  });

  it("uses course title as fallback when no learningObjective", () => {
    const result = generateBridgeText(alexCourse, bobCourse, null);
    expect(result.subtext).toContain(bobCourse.title);
  });

  it("uses continuation for courses without instructors", () => {
    const noInstructor = { title: "Mystery Course" };
    const result = generateBridgeText({ title: "Prev" }, noInstructor, null);
    expect(result.type).toBe("continuation");
    expect(result.text).toContain("Mystery Course");
  });
});

// ── generateProgressText ─────────────────────────────────────────────────
describe("generateProgressText", () => {
  it("calculates correct percent at start", () => {
    const result = generateProgressText(0, 10);
    expect(result.text).toBe("Video 1 of 10");
    expect(result.percent).toBe(10);
    expect(result.isComplete).toBe(false);
  });

  it("marks last video as complete", () => {
    const result = generateProgressText(4, 5);
    expect(result.text).toBe("Video 5 of 5");
    expect(result.percent).toBe(100);
    expect(result.isComplete).toBe(true);
  });

  it("rounds percent correctly", () => {
    const result = generateProgressText(2, 7);
    expect(result.percent).toBe(43); // 3/7 ≈ 0.4286
  });
});
