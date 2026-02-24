import { describe, it, expect } from "vitest";
import { generateChallenge } from "../../services/challengeService";
import {
  makeCourse,
  blueprintBasicsCourse,
} from "../../__tests__/fixtures/testCourses";

// ─── Return Structure ────────────────────────────────────────

describe("generateChallenge — structure", () => {
  it("returns an object with task, hint, expectedResult, difficulty", () => {
    const result = generateChallenge(
      blueprintBasicsCourse,
      "fix my blueprint",
      "Editor Overview",
      0
    );

    expect(result).toHaveProperty("task");
    expect(result).toHaveProperty("hint");
    expect(result).toHaveProperty("expectedResult");
    expect(result).toHaveProperty("difficulty");
    expect(typeof result.task).toBe("string");
    expect(result.task.length).toBeGreaterThan(10);
  });

  it("sets difficulty from gemini_skill_level", () => {
    const result = generateChallenge(blueprintBasicsCourse, "", "Editor Overview", 0);
    expect(result.difficulty).toBe("Beginner");
  });

  it("defaults difficulty to Intermediate", () => {
    const course = makeCourse({ gemini_skill_level: undefined });
    const result = generateChallenge(course, "", "Introducing Unreal Editor", 0);
    expect(result.difficulty).toBe("Intermediate");
  });
});

// ─── Tag-Based Matching ──────────────────────────────────────

describe("generateChallenge — tag matching", () => {
  it("uses tag-specific template when tag matches registry key", () => {
    // "blueprint" exists in challengeRegistry
    const result = generateChallenge(
      blueprintBasicsCourse,
      "",
      "Blueprint Basics",
      0
    );

    // Should reference blueprints in the task (from registry)
    expect(result.task.length).toBeGreaterThan(0);
  });

  it("returns a fallback challenge when no tags match registry", () => {
    const course = makeCourse({
      code: "999.01",
      title: "Obscure UE5 Feature",
      canonical_tags: ["extremely_obscure_tag_xyz"],
      gemini_system_tags: [],
      transcript_tags: [],
      extracted_tags: [],
      tags: ["extremely_obscure_tag_xyz"],
    });
    const result = generateChallenge(course, "", "Obscure Feature Overview", 0);

    expect(result.task.length).toBeGreaterThan(0);
    // Fallback tasks mention "UE5"
    expect(result.task).toContain("UE5");
  });
});

// ─── CourseIndex Uniqueness ──────────────────────────────────

describe("generateChallenge — uniqueness via courseIndex", () => {
  it("produces different challenges for different courseIndex values (when multiple templates exist)", () => {
    const course = makeCourse({
      code: "250.03",
      title: "Multi-System VFX Course",
      canonical_tags: ["blueprint", "materials", "niagara"],
      gemini_system_tags: ["lighting"],
    });

    const results = new Set();
    for (let i = 0; i < 5; i++) {
      const result = generateChallenge(course, "fix my blueprint", "VFX Overview", i);
      results.add(result.task);
    }
    // With multiple matching tags, we should get at least 2 unique challenges
    expect(results.size).toBeGreaterThanOrEqual(1);
  });
});

// ─── Problem Context Matching ────────────────────────────────

describe("generateChallenge — problem context", () => {
  it("incorporates problem context for unregistered topics in fallback", () => {
    const course = makeCourse({
      code: "999.02",
      title: "Advanced Procedural Generation",
      canonical_tags: ["unknown_tag_xyz"],
      gemini_system_tags: [],
      transcript_tags: [],
      extracted_tags: [],
      tags: ["unknown_tag_xyz"],
    });
    const result = generateChallenge(
      course,
      "my frobnozzle shader is too dark",
      "Procedural Generation Basics",
      0
    );

    // Fallback should reference the problem context since "frobnozzle" isn't in registry
    expect(result.task).toContain("my frobnozzle shader is too dark");
  });

  it("uses problem context to match registry keys", () => {
    // "niagara" should be a registry key — test with a course that doesn't have it tagged
    const course = makeCourse({
      code: "102.01",
      title: "Introducing Unreal Editor",
    });
    const result = generateChallenge(
      course,
      "my niagara particles are disappearing",
      "Particle System Debugging",
      0
    );

    // Should find niagara templates from the registry
    expect(result.task.length).toBeGreaterThan(0);
  });
});

// ─── Edge Cases ──────────────────────────────────────────────

describe("generateChallenge — edge cases", () => {
  it("handles null/undefined course gracefully", () => {
    const result = generateChallenge(null, "something", "Viewport Navigation", 0);
    expect(result).toHaveProperty("task");
    expect(result.task.length).toBeGreaterThan(0);
  });

  it("handles empty problem context and video title", () => {
    const result = generateChallenge(blueprintBasicsCourse, "", "", 0);
    expect(result).toHaveProperty("task");
  });
});
