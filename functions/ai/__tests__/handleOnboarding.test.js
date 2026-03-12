/**
 * handleOnboarding.test.js — Unit tests for the onboarding flow handler.
 *
 * Tests:
 *   - Fallback when persona is missing/short
 *   - "plan" step: planner success + failure
 *   - "assemble" step: assembler success + failure + fallback
 *   - Full pipeline: planner → retriever → assembler → response
 *   - Error handling: top-level catch
 */

// ── Mocks ────────────────────────────────────────────────────────────

// Mock requireAuth to return a fake userId
jest.mock("../../utils/authGuard", () => ({
  requireAuth: jest.fn(() => "test-user-123"),
}));

// Mock logApiUsage (fire-and-forget, no need to test)
jest.mock("../../utils/apiUsage", () => ({
  logApiUsage: jest.fn(() => Promise.resolve()),
}));

// Mock telemetry
jest.mock("../../pipeline/telemetry", () => ({
  createTrace: jest.fn(() => ({
    toLog: jest.fn(),
    toDebugPayload: jest.fn(() => ({})),
  })),
}));

// Mock promptVersions
jest.mock("../../pipeline/promptVersions", () => ({
  PROMPT_VERSION: "test-v1",
}));

// Mock prompts
jest.mock("../prompts", () => ({
  FALLBACK_CURRICULUM: { title: "Fallback", lessons: [] },
  ONBOARDING_PLANNER_PROMPT: "Mock planner prompt",
  ONBOARDING_ASSEMBLER_PROMPT: "Mock assembler prompt",
}));

// Mock firebase-functions logger
jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Mock runStage — this is the key mock
const mockRunStage = jest.fn();
jest.mock("../../pipeline/llmStage", () => ({
  runStage: (...args) => mockRunStage(...args),
}));

const { handleOnboarding } = require("../handleOnboarding");

// ── Helpers ──────────────────────────────────────────────────────────

const fakeContext = { auth: { uid: "test-user-123" } };
const fakeApiKey = "test-api-key";

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("handleOnboarding", () => {
  // ── Fallback: missing/short persona ─────────────────────────────

  describe("persona validation", () => {
    it("returns fallback curriculum when persona is missing", async () => {
      const result = await handleOnboarding({}, fakeContext, fakeApiKey);
      expect(result.success).toBe(true);
      expect(result.mode).toBe("onboarding");
      expect(result.fallback).toBe(true);
      expect(result.curriculum).toEqual({ title: "Fallback", lessons: [] });
      expect(result.archetype).toBe("unknown");
    });

    it("returns fallback curriculum when persona is too short", async () => {
      const result = await handleOnboarding({ persona: "hi" }, fakeContext, fakeApiKey);
      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
    });

    it("returns fallback curriculum when persona is empty string", async () => {
      const result = await handleOnboarding({ persona: "" }, fakeContext, fakeApiKey);
      expect(result.fallback).toBe(true);
    });
  });

  // ── Plan step ───────────────────────────────────────────────────

  describe('onboardingStep = "plan"', () => {
    it("returns search queries and archetype on success", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: {
          searchQueries: ["UE5 Blueprint basics", "UE5 first project"],
          archetype: "indie_game_dev",
        },
      });

      const result = await handleOnboarding(
        { persona: "I want to make indie games", onboardingStep: "plan" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.mode).toBe("onboarding");
      expect(result.step).toBe("plan");
      expect(result.searchQueries).toEqual(["UE5 Blueprint basics", "UE5 first project"]);
      expect(result.archetype).toBe("indie_game_dev");
    });

    it("returns error when planner fails", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: false,
        error: "LLM timeout",
      });

      const result = await handleOnboarding(
        { persona: "I want to make games", onboardingStep: "plan" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(false);
      expect(result.step).toBe("plan");
      expect(result.error).toBe("Planner failed");
    });
  });

  // ── Assemble step ───────────────────────────────────────────────

  describe('onboardingStep = "assemble"', () => {
    it("returns curriculum on successful assembly", async () => {
      const mockCurriculum = {
        title: "Indie Game Dev Path",
        lessons: [{ title: "Blueprint Basics" }],
      };
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: mockCurriculum,
      });

      const result = await handleOnboarding(
        {
          persona: "I want to make indie games",
          onboardingStep: "assemble",
          archetype: "indie_game_dev",
          passages: [{ text: "Some text", courseCode: "BP101" }],
        },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.step).toBe("assemble");
      expect(result.curriculum).toEqual(mockCurriculum);
      expect(result.fallback).toBe(false);
      expect(result.archetype).toBe("indie_game_dev");
    });

    it("returns fallback curriculum when assembler fails", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: false,
        error: "LLM error",
      });

      const result = await handleOnboarding(
        {
          persona: "I want to make games",
          onboardingStep: "assemble",
          archetype: "artist",
          passages: [],
        },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
      expect(result.curriculum).toEqual({ title: "Fallback", lessons: [] });
    });
  });

  // ── Full pipeline (default) ─────────────────────────────────────

  describe("full pipeline (no onboardingStep)", () => {
    it("runs planner → retriever → assembler and returns curriculum", async () => {
      // Planner
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: {
          searchQueries: ["UE5 materials"],
          archetype: "tech_artist",
        },
      });
      // Assembler
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: { title: "Tech Art Path", lessons: [{ title: "Materials" }] },
      });

      const result = await handleOnboarding(
        { persona: "I'm a technical artist wanting to learn UE5 materials" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.mode).toBe("onboarding");
      expect(result.archetype).toBe("tech_artist");
      expect(result.curriculum.title).toBe("Tech Art Path");
      expect(result.fallback).toBe(false);
      expect(result.debug_queries).toEqual(["UE5 materials"]);
      expect(mockRunStage).toHaveBeenCalledTimes(2);
    });

    it("returns fallback when planner fails in full pipeline", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: false,
        error: "Planner timeout",
      });

      const result = await handleOnboarding(
        { persona: "I'm a level designer" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
      expect(result.archetype).toBe("unknown");
      expect(mockRunStage).toHaveBeenCalledTimes(1); // Only planner called
    });

    it("returns fallback when assembler fails in full pipeline", async () => {
      mockRunStage
        .mockResolvedValueOnce({
          success: true,
          data: { searchQueries: ["UE5 Niagara"], archetype: "vfx_artist" },
        })
        .mockResolvedValueOnce({
          success: false,
          error: "Assembler error",
        });

      const result = await handleOnboarding(
        { persona: "VFX artist learning Niagara particle systems" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
    });
  });

  // ── Error handling ──────────────────────────────────────────────

  describe("error handling", () => {
    it("catches thrown errors and returns fallback gracefully", async () => {
      mockRunStage.mockRejectedValueOnce(new Error("Network failure"));

      const result = await handleOnboarding(
        { persona: "I'm a game designer who wants to learn UE5" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
      expect(result.curriculum).toEqual({ title: "Fallback", lessons: [] });
    });
  });

  // ── Response shape ──────────────────────────────────────────────

  describe("response shape", () => {
    it("always includes mode and prompt_version", async () => {
      const result = await handleOnboarding({}, fakeContext, fakeApiKey);
      expect(result.mode).toBe("onboarding");
      expect(result.prompt_version).toBe("test-v1");
    });
  });
});
