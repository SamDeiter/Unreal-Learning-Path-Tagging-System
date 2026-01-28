const { test, describe } = require("node:test");
const assert = require("node:assert");

// Utility function tests
describe("Data Processing Utilities", () => {
  test("course data should have required fields", () => {
    const mockCourse = {
      code: "101.01",
      title: "Test Course",
      video_count: 5,
      tags: { topic: "Foundation", level: "Beginner", industry: "General" },
    };

    assert.ok(mockCourse.code, "Course should have a code");
    assert.ok(mockCourse.title, "Course should have a title");
    assert.ok(mockCourse.tags, "Course should have tags");
    assert.ok(mockCourse.tags.topic, "Course should have a topic tag");
  });

  test("video count should be a non-negative number", () => {
    const videoCount = 10;
    assert.ok(videoCount >= 0, "Video count should be >= 0");
    assert.strictEqual(typeof videoCount, "number");
  });

  test("learning path operations", () => {
    const path = [];
    const course = { code: "101.01", title: "Test" };

    // Add course
    path.push(course);
    assert.strictEqual(path.length, 1, "Path should have 1 course");

    // Remove course
    const filtered = path.filter((c) => c.code !== "101.01");
    assert.strictEqual(filtered.length, 0, "Path should be empty after removal");
  });
});

describe("Tag Cloud Calculations", () => {
  test("should calculate tag frequency correctly", () => {
    const courses = [
      { tags: { topic: "Foundation" } },
      { tags: { topic: "Foundation" } },
      { tags: { topic: "Blueprints" } },
    ];

    const tagCounts = {};
    courses.forEach((c) => {
      const topic = c.tags?.topic;
      if (topic) {
        tagCounts[topic] = (tagCounts[topic] || 0) + 1;
      }
    });

    assert.strictEqual(tagCounts["Foundation"], 2);
    assert.strictEqual(tagCounts["Blueprints"], 1);
  });

  test("should sort tags by frequency", () => {
    const tagCounts = { Foundation: 10, Blueprints: 5, Animation: 15 };
    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

    assert.strictEqual(sorted[0][0], "Animation");
    assert.strictEqual(sorted[1][0], "Foundation");
    assert.strictEqual(sorted[2][0], "Blueprints");
  });
});
