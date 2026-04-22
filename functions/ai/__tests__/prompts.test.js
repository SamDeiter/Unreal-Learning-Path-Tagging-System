/**
 * prompts.test.js — Tests for shared prompt constants
 */

const {
  UE5_GUARDRAIL,
  FALLBACK_CURRICULUM,
  ONBOARDING_PLANNER_PROMPT,
  ONBOARDING_ASSEMBLER_PROMPT,
  SOCRATIC_ELICITATION_PROMPT,
} = require("../prompts");

describe("prompts exports", () => {
  describe("UE5_GUARDRAIL", () => {
    it("is a non-empty string", () => {
      expect(typeof UE5_GUARDRAIL).toBe("string");
      expect(UE5_GUARDRAIL.length).toBeGreaterThan(0);
    });

    it("contains critical safety keywords", () => {
      expect(UE5_GUARDRAIL).toContain("CRITICAL");
      expect(UE5_GUARDRAIL).toContain("Unreal Engine 5");
      expect(UE5_GUARDRAIL).toContain("off_topic");
    });

    it("includes injection defense language", () => {
      expect(UE5_GUARDRAIL).toMatch(/ignore|forget|change roles/i);
    });
  });

  describe("FALLBACK_CURRICULUM", () => {
    it("has a title and description", () => {
      expect(FALLBACK_CURRICULUM.title).toBeTruthy();
      expect(FALLBACK_CURRICULUM.description).toBeTruthy();
    });

    it("has exactly 3 modules", () => {
      expect(FALLBACK_CURRICULUM.modules).toHaveLength(3);
    });

    it("each module has required fields", () => {
      FALLBACK_CURRICULUM.modules.forEach((mod) => {
        expect(mod.title).toBeTruthy();
        expect(mod.description).toBeTruthy();
        expect(mod).toHaveProperty("videoId");
        expect(mod).toHaveProperty("timestamp");
        expect(mod).toHaveProperty("citation");
      });
    });
  });

  describe("ONBOARDING_PLANNER_PROMPT", () => {
    it("includes the UE5 guardrail prefix", () => {
      expect(ONBOARDING_PLANNER_PROMPT.startsWith(UE5_GUARDRAIL)).toBe(true);
    });

    it("requests JSON output format", () => {
      expect(ONBOARDING_PLANNER_PROMPT).toContain("searchQueries");
      expect(ONBOARDING_PLANNER_PROMPT).toContain("archetype");
      expect(ONBOARDING_PLANNER_PROMPT).toContain("JSON");
    });

    it("mentions relevant user archetypes", () => {
      expect(ONBOARDING_PLANNER_PROMPT).toContain("Unity");
      expect(ONBOARDING_PLANNER_PROMPT).toContain("Artist");
      expect(ONBOARDING_PLANNER_PROMPT).toContain("Beginner");
    });
  });

  describe("SOCRATIC_ELICITATION_PROMPT (Phase 3 — affective loop)", () => {
    it("returns a string that includes UE5 guardrail by default", () => {
      const s = SOCRATIC_ELICITATION_PROMPT();
      expect(typeof s).toBe("string");
      expect(s).toContain("CRITICAL");
    });

    it("omits the affective block when no directive is passed", () => {
      const s = SOCRATIC_ELICITATION_PROMPT({ engine: "UE5" });
      expect(s).not.toContain("AFFECTIVE SIGNAL");
    });

    it("includes the affective block when a directive is passed", () => {
      const directive =
        "The learner marked the previous response as CONFUSING. Use simpler language.";
      const s = SOCRATIC_ELICITATION_PROMPT({
        engine: "UE5",
        affectiveDirective: directive,
      });
      expect(s).toContain("AFFECTIVE SIGNAL");
      expect(s).toContain("CONFUSING");
    });

    it("includes both prior summary and affective block when both provided", () => {
      const s = SOCRATIC_ELICITATION_PROMPT({
        engine: "UE5",
        priorSummary: "Previous session explored Lumen temporal artifacts.",
        affectiveDirective: "The learner marked the previous response as NOT HELPFUL.",
      });
      expect(s).toContain("LAST SESSION SUMMARY");
      expect(s).toContain("AFFECTIVE SIGNAL");
      expect(s).toContain("NOT HELPFUL");
    });
  });

  describe("ONBOARDING_ASSEMBLER_PROMPT", () => {
    it("includes the UE5 guardrail prefix", () => {
      expect(ONBOARDING_ASSEMBLER_PROMPT.startsWith(UE5_GUARDRAIL)).toBe(true);
    });

    it("specifies grounded video references", () => {
      expect(ONBOARDING_ASSEMBLER_PROMPT).toContain("videoId");
      expect(ONBOARDING_ASSEMBLER_PROMPT).toContain("timestamp");
    });

    it("defines 3-step structure", () => {
      expect(ONBOARDING_ASSEMBLER_PROMPT).toContain("Step 1");
      expect(ONBOARDING_ASSEMBLER_PROMPT).toContain("Step 2");
      expect(ONBOARDING_ASSEMBLER_PROMPT).toContain("Step 3");
    });

    it("requests JSON output", () => {
      expect(ONBOARDING_ASSEMBLER_PROMPT).toContain("JSON");
    });
  });
});
