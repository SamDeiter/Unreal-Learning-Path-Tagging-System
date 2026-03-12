/**
 * roadmapPlanner.test.js — Tests for the LLM roadmap planner module
 */

const {
  isValidMilestone,
  buildRoadmapPrompt,
  REQUIRED_MILESTONE_FIELDS,
} = require("../roadmapPlanner");

describe("roadmapPlanner", () => {
  // ── Milestone validation ────────────────────────────────────────────

  describe("isValidMilestone", () => {
    const validMilestone = {
      phase: "Start Here",
      title: "UE5 Editor Basics",
      learnerGoal: "Navigate the editor and create a new project",
      rationale: "You need to know the editor before anything else",
      searchQuery: "UE5 editor basics getting started tutorial",
      completionCheck: "You can create a new blank project and navigate viewports",
      difficulty: "beginner",
    };

    it("accepts a valid milestone with all fields", () => {
      expect(isValidMilestone(validMilestone)).toBe(true);
    });

    it("rejects null", () => {
      expect(isValidMilestone(null)).toBe(false);
    });

    it("rejects undefined", () => {
      expect(isValidMilestone(undefined)).toBe(false);
    });

    it("rejects a string", () => {
      expect(isValidMilestone("not a milestone")).toBe(false);
    });

    it("rejects empty object", () => {
      expect(isValidMilestone({})).toBe(false);
    });

    it("rejects milestone with missing field", () => {
      const missing = { ...validMilestone };
      delete missing.phase;
      expect(isValidMilestone(missing)).toBe(false);
    });

    it("rejects milestone with empty string field", () => {
      expect(isValidMilestone({ ...validMilestone, title: "" })).toBe(false);
    });

    it("rejects milestone with whitespace-only field", () => {
      expect(isValidMilestone({ ...validMilestone, searchQuery: "   " })).toBe(false);
    });

    it("rejects milestone with numeric field (type mismatch)", () => {
      expect(isValidMilestone({ ...validMilestone, difficulty: 5 })).toBe(false);
    });
  });

  // ── Required fields ─────────────────────────────────────────────────

  describe("REQUIRED_MILESTONE_FIELDS", () => {
    it("contains 7 required fields", () => {
      expect(REQUIRED_MILESTONE_FIELDS).toHaveLength(7);
    });

    it("includes phase, title, learnerGoal, searchQuery", () => {
      expect(REQUIRED_MILESTONE_FIELDS).toContain("phase");
      expect(REQUIRED_MILESTONE_FIELDS).toContain("title");
      expect(REQUIRED_MILESTONE_FIELDS).toContain("learnerGoal");
      expect(REQUIRED_MILESTONE_FIELDS).toContain("searchQuery");
    });
  });

  // ── Prompt builder ──────────────────────────────────────────────────

  describe("buildRoadmapPrompt", () => {
    it("includes the goal text", () => {
      const prompt = buildRoadmapPrompt("I want to make a game", null);
      expect(prompt).toContain("I want to make a game");
    });

    it("includes persona context when provided", () => {
      const prompt = buildRoadmapPrompt("Learn UE5", "indie_isaac");
      expect(prompt).toContain("indie_isaac");
      expect(prompt).toContain("persona");
    });

    it("does NOT include persona line when null", () => {
      const prompt = buildRoadmapPrompt("Learn UE5", null);
      expect(prompt).not.toContain("persona is");
    });

    it("asks for 4 to 6 milestones", () => {
      const prompt = buildRoadmapPrompt("Build a game", null);
      expect(prompt).toContain("4 to 6 milestones");
    });

    it("specifies UE5 in search query requirement", () => {
      const prompt = buildRoadmapPrompt("Learn something", null);
      expect(prompt).toContain("mention UE5");
    });

    it("specifies difficulty enum", () => {
      const prompt = buildRoadmapPrompt("Learn", null);
      expect(prompt).toContain("beginner");
      expect(prompt).toContain("intermediate");
      expect(prompt).toContain("advanced");
    });
  });
});
