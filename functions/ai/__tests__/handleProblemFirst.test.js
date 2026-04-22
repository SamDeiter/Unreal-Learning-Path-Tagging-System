/**
 * handleProblemFirst.test.js — Unit tests for the problem-first handler.
 *
 * Tests the key decision branches:
 *   - Input validation (blocked queries)
 *   - Intent extraction (success / off-topic / failure)
 *   - Confidence routing: clarification, agentic RAG, direct answer
 *   - Response shape for ANSWER, NEEDS_CLARIFICATION, NEEDS_MORE_CONTEXT
 *   - Conversation history sanitization
 *   - Diagnosis cache hit path
 *   - Error resilience (parallel stage failures)
 */

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock("../../utils/authGuard", () => ({
  requireAuth: jest.fn(() => "test-user-456"),
}));

jest.mock("../../utils/apiUsage", () => ({
  logApiUsage: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../pipeline/telemetry", () => ({
  createTrace: jest.fn(() => ({
    toLog: jest.fn(),
    toDebugPayload: jest.fn(() => ({})),
  })),
  isAdmin: jest.fn(() => false),
}));

jest.mock("../../pipeline/promptVersions", () => ({
  PROMPT_VERSION: "test-v1",
  wrapEvidence: jest.fn((text) => `\n--- EVIDENCE ---\n${text}\n--- END ---`),
}));

jest.mock("../prompts", () => ({
  UE5_GUARDRAIL: "UE5 ONLY. ",
  SOCRATIC_ELICITATION_PROMPT: jest.fn(
    ({ priorSummary, affectiveDirective } = {}) =>
      `SOCRATIC_PROMPT${priorSummary ? `|prior:${priorSummary}` : ""}${affectiveDirective ? `|affective:${affectiveDirective}` : ""}`
  ),
}));

// Default: no feedback. Individual tests override via mockReadLatestFeedback.
const mockReadLatestFeedback = jest.fn(() => Promise.resolve(null));
jest.mock("../feedbackReader", () => {
  // Re-implement buildAffectiveDirective inline so tests can assert on directive
  // text without importing the real module (which would drag in firebase-admin
  // before our mock).
  const MAP = {
    confused:
      "The learner marked the previous response as CONFUSING. For this response: use simpler language, add concrete examples, break concepts into smaller steps, and surface any prerequisite knowledge explicitly.",
    already_knew:
      "The learner marked the previous response as ALREADY KNOWN. For this response: compress foundational explanation, skip basics, raise the altitude toward advanced nuance or edge cases.",
    not_helpful:
      "The learner marked the previous response as NOT HELPFUL. For this response: try a fundamentally different angle — a different analogy, a different level of abstraction, or a worked example instead of explanation.",
    rejected:
      "The learner marked the previous response as NOT HELPFUL. For this response: try a fundamentally different angle — a different analogy, a different level of abstraction, or a worked example instead of explanation.",
    helpful: "",
    completed: "",
  };
  return {
    readLatestFeedback: (...args) => mockReadLatestFeedback(...args),
    buildAffectiveDirective: (doc) => {
      if (!doc || typeof doc !== "object") return "";
      return MAP[doc.signal] || "";
    },
  };
});

jest.mock("../confidence", () => ({
  computeConfidence: jest.fn(() => ({ score: 80, reasons: ["good query"] })),
}));

jest.mock("../../utils/sanitizeInput", () => ({
  sanitizeAndValidate: jest.fn((q) => {
    if (!q || q.includes("DROP TABLE")) return { blocked: true, reason: "Injection attempt" };
    return { blocked: false, clean: q };
  }),
}));

jest.mock("../../pipeline/cache", () => ({
  normalizeQuery: jest.fn((q) => q.toLowerCase().trim()),
}));

jest.mock("../../utils/diagnosisCacheUtils", () => ({
  findCachedDiagnosis: jest.fn(() => Promise.resolve({ hit: false })),
  cacheDiagnosis: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../utils/pathCacheUtils", () => ({
  writePathCache: jest.fn(() => Promise.resolve()),
}));

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(() => Promise.resolve()),
      })),
    })),
  })),
}));

// Add FieldValue mock
jest.mock("firebase-admin", () => {
  const mockSet = jest.fn(() => Promise.resolve());
  return {
    firestore: Object.assign(
      jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            set: mockSet,
          })),
        })),
      })),
      { FieldValue: { serverTimestamp: jest.fn(() => "mock-timestamp") } }
    ),
  };
});

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Mock runStage
const mockRunStage = jest.fn();
jest.mock("../../pipeline/llmStage", () => ({
  runStage: (...args) => mockRunStage(...args),
}));

const { handleProblemFirst } = require("../handleProblemFirst");
const { computeConfidence } = require("../confidence");

// ── Helpers ──────────────────────────────────────────────────────────

const fakeContext = { auth: { uid: "test-user-456" } };
const fakeApiKey = "test-api-key";

function makeIntentData() {
  return {
    intent_id: "intent_123",
    user_role: "developer",
    goal: "fix lighting",
    problem_description: "Lumen GI flickers when camera moves",
    systems: ["Lumen", "Camera"],
    constraints: [],
  };
}

function makeDiagnosisData() {
  return {
    diagnosis_id: "diag_123",
    problem_summary: "Lumen temporal instability",
    root_causes: ["Lumen temporal accumulation resets on fast camera movement"],
    signals_to_watch_for: ["Flicker in dark areas"],
    variables_that_matter: ["Lumen Scene Lighting Quality"],
    variables_that_do_not: ["Screen resolution"],
    generalization_scope: ["All Lumen GI scenes"],
    cited_sources: [],
  };
}

function makeObjectivesData() {
  return {
    fix_specific: ["Increase temporal stability settings"],
    transferable: ["Understanding Lumen temporal accumulation"],
  };
}

// Setup for a successful full pipeline (4 parallel stages)
function setupFullPipelineSuccess() {
  mockRunStage
    // Intent
    .mockResolvedValueOnce({ success: true, data: makeIntentData() })
    // Diagnosis
    .mockResolvedValueOnce({ success: true, data: makeDiagnosisData() })
    // Objectives
    .mockResolvedValueOnce({ success: true, data: makeObjectivesData() })
    // Validation (parallel)
    .mockResolvedValueOnce({ success: true, data: { approved: true, reason: "Good" } })
    // Path Summary (parallel)
    .mockResolvedValueOnce({ success: true, data: { path_summary: "Learn Lumen settings", topics_covered: ["Lumen"] } })
    // Micro-lesson (parallel) — skipped since no passages
    // Answer Data (parallel)
    .mockResolvedValueOnce({
      success: true,
      data: {
        mostLikelyCause: "Temporal instability",
        confidence: "high",
        fastChecks: ["Check Lumen quality"],
        fixSteps: ["Go to Project Settings > Lumen"],
        ifStillBrokenBranches: [],
        whyThisResult: ["Lumen uses temporal accumulation"],
      },
    });
}

beforeEach(() => {
  jest.clearAllMocks();
  computeConfidence.mockReturnValue({ score: 80, reasons: ["good query"] });
  mockReadLatestFeedback.mockReset();
  mockReadLatestFeedback.mockResolvedValue(null);
});

// ── Tests ────────────────────────────────────────────────────────────

describe("handleProblemFirst", () => {
  // ── Input validation ────────────────────────────────────────────

  describe("input validation", () => {
    it("blocks injection attempts via sanitizeAndValidate", async () => {
      const result = await handleProblemFirst(
        { query: "DROP TABLE users" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(false);
      expect(result.mode).toBe("problem-first");
      expect(result.error).toBe("Injection attempt");
    });
  });

  // ── Intent extraction ───────────────────────────────────────────

  describe("intent extraction", () => {
    it("returns off_topic when intent fails with off-topic raw text", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: false,
        error: { rawText: "off_topic: not UE5" },
      });

      const result = await handleProblemFirst(
        { query: "How to cook pasta" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("off_topic");
      expect(result.message).toContain("UE5");
    });

    it("returns generic error when intent fails without off-topic", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: false,
        error: "LLM timeout",
      });

      const result = await handleProblemFirst(
        { query: "Blueprint compile error in my project" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("LLM timeout");
    });
  });

  // ── Confidence routing: clarification ───────────────────────────

  describe("confidence routing — clarification", () => {
    it("asks clarifying question when confidence < 50 and rounds remain", async () => {
      computeConfidence.mockReturnValue({ score: 30, reasons: ["vague query"] });

      // Intent succeeds
      mockRunStage.mockResolvedValueOnce({ success: true, data: makeIntentData() });
      // Clarification question succeeds
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: {
          question: "What renderer are you using?",
          options: ["Lumen", "Path Tracing", "Forward"],
          whyAsking: "Helps narrow the GI algorithm",
          intent_id: "clarify",
        },
      });

      const result = await handleProblemFirst(
        { query: "Lighting looks wrong" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.responseType).toBe("NEEDS_CLARIFICATION");
      expect(result.question).toBe("What renderer are you using?");
      expect(result.options).toHaveLength(3);
      expect(result.clarifyRound).toBe(1);
    });
  });

  // ── Confidence routing: agentic RAG ─────────────────────────────

  describe("confidence routing — agentic RAG", () => {
    it("returns NEEDS_MORE_CONTEXT when low confidence + few passages + max clarify rounds reached", async () => {
      computeConfidence.mockReturnValue({ score: 30, reasons: ["vague"] });

      // Intent succeeds
      mockRunStage.mockResolvedValueOnce({ success: true, data: makeIntentData() });
      // clarifyRound=3 == MAX_CLARIFY_ROUNDS, so clarification branch is SKIPPED.
      // Agentic search succeeds (this is the 2nd mock call, not 3rd)
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: {
          searchQueries: ["UE5 Lumen temporal stability", "UE5 GI flicker fix"],
          searchReason: "Need specific Lumen settings documentation",
          intent_id: "search_strategy",
        },
      });

      const result = await handleProblemFirst(
        { query: "Lighting looks wrong", conversationHistory: [
          { role: "assistant", content: "What renderer?" },
          { role: "user", content: "Lumen" },
          { role: "assistant", content: "What about quality?" },
          { role: "user", content: "Default" },
          { role: "assistant", content: "Screen percentage?" },
          { role: "user", content: "100" },
        ]},
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.responseType).toBe("NEEDS_MORE_CONTEXT");
      expect(result.searchQueries).toHaveLength(2);
      expect(result.agenticRound).toBe(1);
    });
  });

  // ── Full pipeline: ANSWER response ──────────────────────────────

  describe("full pipeline — direct answer", () => {
    it("returns complete ANSWER response with all fields", async () => {
      setupFullPipelineSuccess();

      const result = await handleProblemFirst(
        { query: "Lumen GI flickers when camera moves" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.mode).toBe("problem-first");
      expect(result.responseType).toBe("ANSWER");
      // Answer-first fields
      expect(result.mostLikelyCause).toBe("Temporal instability");
      expect(result.confidence).toBe("high");
      expect(result.fastChecks).toEqual(["Check Lumen quality"]);
      expect(result.fixSteps).toEqual(["Go to Project Settings > Lumen"]);
      // Cart
      expect(result.cart).toBeDefined();
      expect(result.cart.mode).toBe("problem-first");
      expect(result.cart.intent).toBeDefined();
      expect(result.cart.diagnosis).toBeDefined();
      expect(result.cart.objectives).toBeDefined();
      // Learn path
      expect(result.learnPath).toBeDefined();
      expect(result.learnPath.pathSummary).toBe("Learn Lumen settings");
    });

    it("includes evidence array in response", async () => {
      setupFullPipelineSuccess();

      const result = await handleProblemFirst(
        {
          query: "Lumen flickers",
          retrievedContext: [
            { text: "Lumen uses temporal", courseCode: "LUM101", videoTitle: "Lumen Basics", timestamp: "2:30" },
          ],
        },
        fakeContext,
        fakeApiKey
      );

      expect(result.evidence).toBeDefined();
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence[0].courseCode).toBe("LUM101");
    });
  });

  // ── Diagnosis failure ───────────────────────────────────────────

  describe("diagnosis failure", () => {
    it("returns error when diagnosis stage fails", async () => {
      mockRunStage
        .mockResolvedValueOnce({ success: true, data: makeIntentData() })
        .mockResolvedValueOnce({ success: false, error: "Diagnosis LLM error" });

      const result = await handleProblemFirst(
        { query: "Blueprint compile error in animation graph" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Diagnosis LLM error");
    });
  });

  // ── Objectives failure ──────────────────────────────────────────

  describe("objectives failure", () => {
    it("returns error when objectives stage fails", async () => {
      mockRunStage
        .mockResolvedValueOnce({ success: true, data: makeIntentData() })
        .mockResolvedValueOnce({ success: true, data: makeDiagnosisData() })
        .mockResolvedValueOnce({ success: false, error: "Objectives LLM error" });

      const result = await handleProblemFirst(
        { query: "Niagara particles not spawning" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Objectives LLM error");
    });
  });

  // ── Conversation history sanitization ───────────────────────────

  describe("conversation history sanitization", () => {
    it("caps conversation history to MAX_CLARIFY_ROUNDS * 2 entries", async () => {
      setupFullPipelineSuccess();

      // 10 entries → should be capped to 6 (MAX_CLARIFY_ROUNDS=3, *2=6)
      const longHistory = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i}`,
      }));

      const result = await handleProblemFirst(
        { query: "Lumen GI flickers", conversationHistory: longHistory },
        fakeContext,
        fakeApiKey
      );

      // Should still succeed (history is sanitized internally)
      expect(result.success).toBe(true);
    });
  });

  // ── Case report sanitization ────────────────────────────────────

  describe("case report handling", () => {
    it("includes sanitized case report in intent extraction", async () => {
      setupFullPipelineSuccess();

      const result = await handleProblemFirst(
        {
          query: "Lumen flickers",
          caseReport: {
            engineVersion: "5.3",
            platform: "Windows",
            renderer: "Deferred",
            errorStrings: ["GI flicker"],
            features: ["Lumen"],
          },
        },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      // Verify runStage was called with case context in the user prompt
      const intentCall = mockRunStage.mock.calls[0][0];
      expect(intentCall.userPrompt).toContain("5.3");
      expect(intentCall.userPrompt).toContain("Windows");
    });
  });

  // ── Socratic elicitation (opt-in "Tutor me") ───────────────────

  describe("socratic elicitation", () => {
    it("returns SOCRATIC_ELICIT when socratic=true AND conversationHistory is empty", async () => {
      // Intent succeeds
      mockRunStage.mockResolvedValueOnce({ success: true, data: makeIntentData() });
      // Socratic elicitation stage succeeds
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: {
          kind: "clarify",
          question: "When you say the Lumen GI flickers, is the flicker tied to camera motion or to lighting changes in the scene?",
          intent: "Learner assumes the bug is in Lumen; probing whether it's actually camera-driven.",
        },
      });

      const result = await handleProblemFirst(
        { query: "Lumen GI flickers when camera moves", socratic: true },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.responseType).toBe("SOCRATIC_ELICIT");
      expect(result.kind).toBe("clarify");
      expect(result.question).toContain("Lumen");
      expect(result.intent).toBeTruthy();
      // Only 2 runStage calls: intent + socratic. No diagnosis/objectives.
      expect(mockRunStage).toHaveBeenCalledTimes(2);
    });

    it("falls through to full diagnosis when socratic=true BUT conversationHistory is non-empty", async () => {
      setupFullPipelineSuccess();

      const result = await handleProblemFirst(
        {
          query: "Lumen GI flickers when camera moves",
          socratic: true,
          conversationHistory: [
            { role: "assistant", content: "Is the flicker tied to camera motion?" },
            { role: "user", content: "Yes, only when I pan quickly." },
          ],
        },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.responseType).toBe("ANSWER");
      // Socratic stage must NOT have been invoked on a follow-up turn.
      // Expect: intent, diagnosis, objectives, validation, path_summary, answer
      // = 6 runStage calls (micro-lesson skipped since no passages).
      expect(mockRunStage).toHaveBeenCalledTimes(6);
    });

    it("runs normal diagnosis when socratic=false (default)", async () => {
      setupFullPipelineSuccess();

      const result = await handleProblemFirst(
        { query: "Lumen GI flickers when camera moves", socratic: false },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.responseType).toBe("ANSWER");
      expect(mockRunStage).toHaveBeenCalledTimes(6);
    });

    it("falls through to normal pipeline if Socratic stage fails", async () => {
      // Intent ok
      mockRunStage.mockResolvedValueOnce({ success: true, data: makeIntentData() });
      // Socratic stage fails
      mockRunStage.mockResolvedValueOnce({ success: false, error: "socratic LLM error" });
      // Then the rest of the pipeline kicks in
      mockRunStage
        .mockResolvedValueOnce({ success: true, data: makeDiagnosisData() })
        .mockResolvedValueOnce({ success: true, data: makeObjectivesData() })
        .mockResolvedValueOnce({ success: true, data: { approved: true, reason: "ok" } })
        .mockResolvedValueOnce({ success: true, data: { path_summary: "sum", topics_covered: [] } })
        .mockResolvedValueOnce({
          success: true,
          data: {
            mostLikelyCause: "Fallback cause",
            confidence: "med",
            fastChecks: [],
            fixSteps: [],
            ifStillBrokenBranches: [],
            whyThisResult: [],
          },
        });

      const result = await handleProblemFirst(
        { query: "Lumen GI flickers when camera moves", socratic: true },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.responseType).toBe("ANSWER");
    });
  });

  // ── Affective feedback loop (Phase 3) ───────────────────────────

  describe("affective feedback loop", () => {
    it("injects confused directive into the diagnosis system prompt", async () => {
      mockReadLatestFeedback.mockResolvedValue({
        id: "fb-1",
        signal: "confused",
        sessionId: "sess-xyz",
        createdAt: Date.now() - 60_000,
      });
      setupFullPipelineSuccess();

      const result = await handleProblemFirst(
        { query: "Lumen GI flickers", sessionId: "sess-xyz" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.responseType).toBe("ANSWER");
      // Diagnosis is the 2nd runStage call (index 1). Its systemPrompt should
      // contain the CONFUSING directive text.
      const diagnosisCall = mockRunStage.mock.calls[1][0];
      expect(diagnosisCall.stage).toBe("diagnosis");
      expect(diagnosisCall.systemPrompt).toContain("AFFECTIVE SIGNAL");
      expect(diagnosisCall.systemPrompt).toContain("CONFUSING");
    });

    it("falls back to priorSessionId feedback when in-session has none", async () => {
      // First call (in-session) → null, second call (priorSessionId) → confused
      mockReadLatestFeedback
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "fb-2",
          signal: "already_knew",
          sessionId: "prev-session",
          createdAt: Date.now() - 30_000,
        });
      setupFullPipelineSuccess();

      const result = await handleProblemFirst(
        {
          query: "Nanite LOD edge case",
          sessionId: "sess-new",
          priorSessionId: "prev-session",
        },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(mockReadLatestFeedback).toHaveBeenCalledTimes(2);
      const diagnosisCall = mockRunStage.mock.calls[1][0];
      expect(diagnosisCall.systemPrompt).toContain("ALREADY KNOWN");
    });

    it("emits no affective block when feedback signal is helpful (no directive)", async () => {
      mockReadLatestFeedback.mockResolvedValue({
        id: "fb-3",
        signal: "helpful",
        createdAt: Date.now() - 60_000,
      });
      setupFullPipelineSuccess();

      const result = await handleProblemFirst(
        { query: "Lumen GI flickers", sessionId: "sess-1" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      const diagnosisCall = mockRunStage.mock.calls[1][0];
      expect(diagnosisCall.systemPrompt).not.toContain("AFFECTIVE SIGNAL (from prior response):");
    });

    it("emits no affective block when no feedback exists", async () => {
      mockReadLatestFeedback.mockResolvedValue(null);
      setupFullPipelineSuccess();

      const result = await handleProblemFirst(
        { query: "Blueprint compile error", sessionId: "sess-1" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      const diagnosisCall = mockRunStage.mock.calls[1][0];
      expect(diagnosisCall.systemPrompt).not.toContain("AFFECTIVE SIGNAL (from prior response):");
    });

    it("threads directive into Socratic prompt when socratic=true and feedback exists", async () => {
      const { SOCRATIC_ELICITATION_PROMPT } = require("../prompts");
      mockReadLatestFeedback.mockResolvedValue({
        id: "fb-4",
        signal: "not_helpful",
        sessionId: "sess-xyz",
        createdAt: Date.now() - 10_000,
      });

      // Intent ok; socratic stage ok
      mockRunStage.mockResolvedValueOnce({ success: true, data: makeIntentData() });
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: { kind: "clarify", question: "What have you already tried?", intent: "probe prior attempts" },
      });

      const result = await handleProblemFirst(
        { query: "Lumen GI flickers", socratic: true, sessionId: "sess-xyz" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.responseType).toBe("SOCRATIC_ELICIT");
      // Verify the SOCRATIC prompt builder received a non-empty affectiveDirective.
      const socraticArgs = SOCRATIC_ELICITATION_PROMPT.mock.calls[0][0];
      expect(socraticArgs.affectiveDirective).toContain("NOT HELPFUL");
    });
  });

  // ── Parallel stage resilience ───────────────────────────────────

  describe("parallel stage resilience", () => {
    it("still returns ANSWER even if validation stage rejects", async () => {
      mockRunStage
        .mockResolvedValueOnce({ success: true, data: makeIntentData() })
        .mockResolvedValueOnce({ success: true, data: makeDiagnosisData() })
        .mockResolvedValueOnce({ success: true, data: makeObjectivesData() })
        // Validation rejects
        .mockRejectedValueOnce(new Error("Validation crashed"))
        // Path summary
        .mockResolvedValueOnce({ success: true, data: { path_summary: "Summary", topics_covered: [] } })
        // Answer data
        .mockResolvedValueOnce({ success: true, data: { mostLikelyCause: "Unknown", confidence: "med", fastChecks: [], fixSteps: [], ifStillBrokenBranches: [], whyThisResult: [] } });

      const result = await handleProblemFirst(
        { query: "Nanite mesh not rendering correctly" },
        fakeContext,
        fakeApiKey
      );

      // Should still return a result (validation failure is non-blocking)
      expect(result.success).toBe(true);
      expect(result.responseType).toBe("ANSWER");
    });
  });
});
