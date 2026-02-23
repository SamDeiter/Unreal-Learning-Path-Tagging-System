/**
 * Narrator Service Tests
 *
 * Tests the pure utility functions that generate intro text, bridge text,
 * progress tracking, instructor extraction, and duration formatting.
 * No external dependencies — all functions are pure.
 */
import { describe, it, expect } from "vitest";
import {
  generatePathIntro,
  generateBridgeText,
  generateProgressText,
} from "../services/narratorService";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. generatePathIntro
// ═══════════════════════════════════════════════════════════════════════════════

describe("generatePathIntro", () => {
  it("should return a default intro when no courses are provided", () => {
    const result = generatePathIntro({
      problemSummary: "test problem",
      courses: [],
      diagnosis: null,
    });
    expect(result.title).toBe("Your Learning Path");
    expect(result.intro).toBeDefined();
    expect(result.instructors).toEqual([]);
  });

  it("should generate intro with courses", () => {
    const courses = [
      {
        title: "Lumen Basics by Sarah",
        videos: [{ duration_seconds: 300 }, { duration_seconds: 600 }],
      },
      {
        title: "Nanite Setup by John",
        videos: [{ duration_seconds: 450 }],
      },
    ];

    const result = generatePathIntro({
      problemSummary: "Lumen reflections are flickering",
      courses,
      diagnosis: { root_causes: ["Incorrect Lumen settings"] },
    });

    expect(result.title).toContain("Lumen reflections");
    expect(result.courseCount).toBe(2);
    expect(result.rootCauses).toHaveLength(1);
    expect(result.totalDuration).toBeDefined();
  });

  it("should include instructor names when available", () => {
    const courses = [
      { title: "Course by Alice", videos: [] },
    ];

    const result = generatePathIntro({
      problemSummary: "test",
      courses,
      diagnosis: null,
    });

    // Should extract "Alice" from title
    expect(result.instructors.length).toBeGreaterThan(0);
    expect(result.instructors[0].name).toBe("Alice");
  });

  it("should handle null diagnosis gracefully", () => {
    const result = generatePathIntro({
      problemSummary: "test",
      courses: [{ title: "Course 1", videos: [] }],
      diagnosis: null,
    });
    expect(result.rootCauses).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. generateBridgeText
// ═══════════════════════════════════════════════════════════════════════════════

describe("generateBridgeText", () => {
  it("should return completion text when nextCourse is null", () => {
    const result = generateBridgeText(
      { title: "Previous Course" },
      null,
      null
    );
    expect(result.type).toBe("completion");
    expect(result.text).toContain("Congratulations");
  });

  it("should return transition text for different instructors", () => {
    const result = generateBridgeText(
      { title: "Course by Alice", instructor: "Alice" },
      { title: "Course by Bob", instructor: "Bob" },
      "Learn about Nanite"
    );
    expect(result.type).toBe("transition");
    expect(result.text).toContain("Bob");
  });

  it("should return continuation text for same instructor", () => {
    const result = generateBridgeText(
      { title: "Course 1", instructor: "Alice" },
      { title: "Course 2: Advanced", instructor: "Alice" },
      null
    );
    expect(result.type).toBe("continuation");
    expect(result.text).toContain("Course 2: Advanced");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. generateProgressText
// ═══════════════════════════════════════════════════════════════════════════════

describe("generateProgressText", () => {
  it("should calculate correct progress", () => {
    const result = generateProgressText(0, 5);
    expect(result.text).toBe("Video 1 of 5");
    expect(result.percent).toBe(20);
    expect(result.isComplete).toBe(false);
  });

  it("should mark complete at last video", () => {
    const result = generateProgressText(4, 5);
    expect(result.text).toBe("Video 5 of 5");
    expect(result.percent).toBe(100);
    expect(result.isComplete).toBe(true);
  });

  it("should handle single video", () => {
    const result = generateProgressText(0, 1);
    expect(result.percent).toBe(100);
    expect(result.isComplete).toBe(true);
  });
});
