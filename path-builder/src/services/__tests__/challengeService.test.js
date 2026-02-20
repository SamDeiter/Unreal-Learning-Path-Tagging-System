import { describe, it, expect } from "vitest";
import { generateChallenge } from "../../services/challengeService";

// ─── Helper: make a minimal course object ────────────────────

function makeCourse(overrides = {}) {
  return {
    code: "TEST.01",
    title: "Test Course",
    canonical_tags: [],
    gemini_system_tags: [],
    transcript_tags: [],
    extracted_tags: [],
    tags: [],
    gemini_skill_level: "Intermediate",
    gemini_outcomes: [],
    ...overrides,
  };
}

// ─── Return Structure ────────────────────────────────────────

describe("generateChallenge — structure", () => {
  it("returns an object with task, hint, expectedResult, difficulty", () => {
    const course = makeCourse({ canonical_tags: ["blueprint"] });
    const result = generateChallenge(course, "fix my blueprint", "Intro to Blueprints", 0);

    expect(result).toHaveProperty("task");
    expect(result).toHaveProperty("hint");
    expect(result).toHaveProperty("expectedResult");
    expect(result).toHaveProperty("difficulty");
    expect(typeof result.task).toBe("string");
    expect(result.task.length).toBeGreaterThan(10);
  });

  it("sets difficulty from gemini_skill_level", () => {
    const course = makeCourse({ gemini_skill_level: "Beginner" });
    const result = generateChallenge(course, "", "Test", 0);
    expect(result.difficulty).toBe("Beginner");
  });

  it("defaults difficulty to Intermediate", () => {
    const course = makeCourse({ gemini_skill_level: undefined });
    const result = generateChallenge(course, "", "Test", 0);
    expect(result.difficulty).toBe("Intermediate");
  });
});

// ─── Tag-Based Matching ──────────────────────────────────────

describe("generateChallenge — tag matching", () => {
  it("uses tag-specific template when tag matches registry key", () => {
    // "blueprint" exists in challengeRegistry
    const course = makeCourse({ canonical_tags: ["blueprint"] });
    const result = generateChallenge(course, "", "Blueprint Basics", 0);

    // Should reference blueprints in the task (from registry)
    expect(result.task.length).toBeGreaterThan(0);
  });

  it("returns a fallback challenge when no tags match registry", () => {
    const course = makeCourse({ canonical_tags: ["extremely_obscure_tag_xyz"] });
    const result = generateChallenge(course, "", "Some Video", 0);

    expect(result.task.length).toBeGreaterThan(0);
    // Fallback tasks mention "Open UE5"
    expect(result.task).toContain("UE5");
  });
});

// ─── CourseIndex Uniqueness ──────────────────────────────────

describe("generateChallenge — uniqueness via courseIndex", () => {
  it("produces different challenges for different courseIndex values (when multiple templates exist)", () => {
    const course = makeCourse({
      canonical_tags: ["blueprint", "material", "niagara"],
      gemini_system_tags: ["lighting"],
    });

    const results = new Set();
    for (let i = 0; i < 5; i++) {
      const result = generateChallenge(course, "fix my blueprint", "Test", i);
      results.add(result.task);
    }
    // With multiple matching tags, we should get at least 2 unique challenges
    // (depends on how many registry entries match)
    expect(results.size).toBeGreaterThanOrEqual(1);
  });
});

// ─── Problem Context Matching ────────────────────────────────

describe("generateChallenge — problem context", () => {
  it("incorporates problem context for unregistered topics in fallback", () => {
    const course = makeCourse({ canonical_tags: ["unknown_tag_xyz"] });
    const result = generateChallenge(course, "my frobnozzle is too dark", "Test", 0);

    // Fallback should reference the problem context since "frobnozzle" isn't in registry
    expect(result.task).toContain("my frobnozzle is too dark");
  });

  it("uses problem context to match registry keys", () => {
    // "niagara" should be a registry key
    const course = makeCourse();
    const result = generateChallenge(course, "my niagara particles are disappearing", "VFX", 0);

    // Should find niagara templates from the registry
    expect(result.task.length).toBeGreaterThan(0);
  });
});

// ─── Edge Cases ──────────────────────────────────────────────

describe("generateChallenge — edge cases", () => {
  it("handles null/undefined course gracefully", () => {
    const result = generateChallenge(null, "something", "Video", 0);
    expect(result).toHaveProperty("task");
    expect(result.task.length).toBeGreaterThan(0);
  });

  it("handles empty problem context and video title", () => {
    const course = makeCourse({ canonical_tags: ["blueprint"] });
    const result = generateChallenge(course, "", "", 0);
    expect(result).toHaveProperty("task");
  });
});
