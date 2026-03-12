/**
 * routing.test.js — Tests for query mode detection
 */

const { detectMode } = require("../routing");

describe("detectMode", () => {
  describe("onboarding detection", () => {
    it('returns "onboarding" when mode is explicitly "onboarding"', () => {
      expect(detectMode({ mode: "onboarding" })).toBe("onboarding");
    });

    it('returns "onboarding" when isOnboarding flag is true', () => {
      expect(detectMode({ isOnboarding: true })).toBe("onboarding");
    });

    it('returns "onboarding" for persona without problem indicators', () => {
      expect(detectMode({ persona: { name: "Beginner" }, query: "lighting" })).toBe(
        "onboarding"
      );
    });

    it('returns "onboarding" for persona with no query', () => {
      expect(detectMode({ persona: { name: "Artist" } })).toBe("onboarding");
    });
  });

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

    it('returns "problem-first" for long query without persona', () => {
      expect(
        detectMode({ query: "How do I set up landscape material layers with auto painting?" })
      ).toBe("problem-first");
    });
  });

  describe("unknown detection", () => {
    it('returns "unknown" for empty data', () => {
      expect(detectMode({})).toBe("unknown");
    });

    it('returns "unknown" for short query without persona or mode', () => {
      expect(detectMode({ query: "hi" })).toBe("unknown");
    });
  });

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
  });
});
