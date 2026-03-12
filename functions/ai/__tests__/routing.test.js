/**
 * routing.test.js — Tests for query mode detection (including goal-build)
 */

const { detectMode, GOAL_BUILD_INDICATORS, PROBLEM_INDICATORS } = require("../routing");

describe("detectMode", () => {
  // ── Goal-Build detection ────────────────────────────────────────────

  describe("goal-build detection", () => {
    it('returns "goal-build" when mode is explicitly "goal-build"', () => {
      expect(detectMode({ mode: "goal-build" })).toBe("goal-build");
    });

    it('detects "goal-build" from beginner goal queries', () => {
      expect(detectMode({ query: "I'm new to UE5 and want to make a game" })).toBe("goal-build");
    });

    it('detects "goal-build" from "from scratch" queries', () => {
      expect(detectMode({ query: "I want to learn Unreal from scratch" })).toBe("goal-build");
    });

    it('detects "goal-build" from "first game" queries', () => {
      expect(detectMode({ query: "I want to make my first game in UE5" })).toBe("goal-build");
    });

    it('detects "goal-build" from "getting started" queries', () => {
      expect(detectMode({ query: "Getting started with UE5" })).toBe("goal-build");
    });

    it('detects "goal-build" from "roadmap" queries', () => {
      expect(detectMode({ query: "Give me a roadmap for game development" })).toBe("goal-build");
    });

    it('detects "goal-build" from "teach me" queries', () => {
      expect(detectMode({ query: "Teach me Unreal Engine" })).toBe("goal-build");
    });

    it("does NOT detect goal-build when problem indicators are present", () => {
      expect(detectMode({ query: "I'm a beginner and I have an error" })).toBe("problem-first");
    });

    it("does NOT detect goal-build when crash + beginner are mixed", () => {
      expect(detectMode({ query: "beginner here, the editor crashes" })).toBe("problem-first");
    });

    it('goal-build wins over onboarding for persona + goal query', () => {
      expect(
        detectMode({ persona: { name: "Dev" }, query: "I want to learn UE5 from scratch" })
      ).toBe("goal-build");
    });
  });

  // ── Onboarding detection ────────────────────────────────────────────

  describe("onboarding detection", () => {
    it('returns "onboarding" when mode is explicitly "onboarding"', () => {
      expect(detectMode({ mode: "onboarding" })).toBe("onboarding");
    });

    it('returns "onboarding" when isOnboarding flag is true', () => {
      expect(detectMode({ isOnboarding: true })).toBe("onboarding");
    });

    it('returns "onboarding" for persona + non-goal, non-problem short query', () => {
      expect(detectMode({ persona: { name: "Artist" }, query: "lighting" })).toBe("onboarding");
    });

    it('returns "onboarding" for persona with no query', () => {
      expect(detectMode({ persona: { name: "Artist" } })).toBe("onboarding");
    });
  });

  // ── Problem-First detection ─────────────────────────────────────────

  describe("problem-first detection", () => {
    it('returns "problem-first" when mode is "problem-first"', () => {
      expect(detectMode({ mode: "problem-first" })).toBe("problem-first");
    });

    it('returns "problem-first" when mode is "problem"', () => {
      expect(detectMode({ mode: "problem" })).toBe("problem-first");
    });

    it("detects problem from error keyword", () => {
      expect(
        detectMode({ persona: { name: "Dev" }, query: "Blueprint compile error" })
      ).toBe("problem-first");
    });

    it("detects problem from crash keyword", () => {
      expect(
        detectMode({ persona: { name: "Dev" }, query: "Editor crash on startup" })
      ).toBe("problem-first");
    });

    it("detects problem from debug keyword", () => {
      expect(
        detectMode({ persona: { name: "Dev" }, query: "how to debug AI behavior trees" })
      ).toBe("problem-first");
    });

    it("detects problem from access violation", () => {
      expect(
        detectMode({ persona: { name: "Dev" }, query: "access violation in tick" })
      ).toBe("problem-first");
    });

    it("detects problem from flicker keyword", () => {
      expect(
        detectMode({ query: "My Lumen flickers when I move the camera" })
      ).toBe("problem-first");
    });

    it('returns "problem-first" for long query without persona or goal indicators', () => {
      expect(
        detectMode({ query: "How do I set up landscape material layers with auto painting?" })
      ).toBe("problem-first");
    });
  });

  // ── Unknown detection ───────────────────────────────────────────────

  describe("unknown detection", () => {
    it('returns "unknown" for empty data', () => {
      expect(detectMode({})).toBe("unknown");
    });

    it('returns "unknown" for short query without persona or mode', () => {
      expect(detectMode({ query: "hi" })).toBe("unknown");
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles null/undefined fields gracefully", () => {
      expect(detectMode({ query: null, persona: null })).toBe("unknown");
    });

    it("mode flag takes priority over content analysis", () => {
      // Even though query has "error", explicit mode=onboarding wins
      expect(
        detectMode({ mode: "onboarding", query: "Blueprint compile error" })
      ).toBe("onboarding");
    });

    it("explicit goal-build mode overrides everything", () => {
      expect(
        detectMode({ mode: "goal-build", query: "fix my crash" })
      ).toBe("goal-build");
    });
  });

  // ── Indicator list coverage ─────────────────────────────────────────

  describe("indicator lists", () => {
    it("exports GOAL_BUILD_INDICATORS as a non-empty array", () => {
      expect(Array.isArray(GOAL_BUILD_INDICATORS)).toBe(true);
      expect(GOAL_BUILD_INDICATORS.length).toBeGreaterThan(10);
    });

    it("exports PROBLEM_INDICATORS as a non-empty array", () => {
      expect(Array.isArray(PROBLEM_INDICATORS)).toBe(true);
      expect(PROBLEM_INDICATORS.length).toBeGreaterThan(10);
    });
  });
});
