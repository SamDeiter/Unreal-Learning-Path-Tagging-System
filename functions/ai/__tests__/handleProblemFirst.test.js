/**
 * handleProblemFirst.test.js — Unit tests for the SLIM problem-first handler.
 *
 * Tests the key decision branches of the post-audit 2-call architecture:
 *   - Input validation (blocked queries)
 *   - Cache hit path (returns cached response)
 *   - Zero-retrieval refusal (NEEDS_MORE_CONTEXT)
 *   - Tutor answer (single runStage "tutor_answer" → ANSWER)
 *   - Off-topic detection
 *   - Error resilience (LLM failure)
 *   - Response shape validation (evidence, citations, learnPath, cart shim)
 *   - Case report sanitization
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
    request_id: "trace-123",
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

jest.mock("../../utils/sanitizeInput", () => ({
  sanitizeAndValidate: jest.fn((q) => {
    if (!q || q.includes("DROP TABLE")) return { blocked: true, reason: "Injection attempt" };
    return { blocked: false, clean: q };
  }),
}));

jest.mock("../../pipeline/queryEmbedding", () => ({
  embedQueryText: jest.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
}));

jest.mock("../../pipeline/citations", () => ({
  validateCitations: jest.fn(() => ({
    valid: [1, 2],
    invalid: [],
    total_cited: 2,
    uncited: [],
  })),
}));

jest.mock("../../pipeline/retrievalLog", () => ({
  logRetrieval: jest.fn(),
}));

jest.mock("../sessions", () => ({
  writeSession: jest.fn(() => Promise.resolve("session-abc")),
}));

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
const { findCachedDiagnosis } = require("../../utils/diagnosisCacheUtils");
const { logRetrieval } = require("../../pipeline/retrievalLog");
const { validateCitations } = require("../../pipeline/citations");
const { writeSession } = require("../sessions");

// ── Helpers ──────────────────────────────────────────────────────────

const fakeContext = { auth: { uid: "test-user-456" } };
const fakeApiKey = "test-api-key";

function makeTutorAnswerData() {
  return {
    systems: ["Lumen", "Camera"],
    mostLikelyCause: "Lumen temporal accumulation resets on fast camera movement",
    confidence: "high",
    howItWorks:
      "Lumen computes global illumination by accumulating light bounces across frames. When the camera moves quickly, the temporal history is invalidated and Lumen must rebuild from scratch, which is what manifests as flicker [1].",
    diagram:
      "flowchart LR\n  Cam[Camera Movement] -- invalidates --> Hist[Temporal History]\n  Hist -- feeds --> LumenGI[Lumen GI]\n  LumenGI -- renders --> Frame[Frame Output]",
    fastChecks: [
      "Check Lumen Scene Lighting Quality — should be 4, not 1",
      "Check r.Lumen.ScreenProbeGather.TemporalFilterAlpha value",
    ],
    fixSteps: [
      "Open Project Settings > Engine > Rendering > Global Illumination",
      "Set Lumen Scene Lighting Quality to 4",
      "Set r.Lumen.ScreenProbeGather.TemporalFilterAlpha to 0.1 via console",
    ],
    ifStillBroken: [
      { condition: "Flicker persists in dark areas only", action: "Enable Distance Field AO as supplement" },
      { condition: "Flicker appears on all surfaces", action: "Check if Nanite is enabled — Nanite+Lumen interact differently" },
    ],
    whyThisResult: [
      "Lumen uses temporal accumulation that resets when the camera moves quickly [1]",
      "Lowering the temporal filter alpha increases stability at the cost of slight softening [2]",
    ],
    objectives: {
      fixSpecific: ["Set Lumen quality to 4", "Tune temporal filter alpha"],
      transferable: [
        "Diagnose temporal-based rendering artifacts by correlating flicker with camera motion",
        "Tune Lumen quality vs performance tradeoffs for real-time lighting",
      ],
    },
    pathSummary:
      "You'll learn to stabilize Lumen GI by tuning temporal accumulation settings, understanding how camera motion affects probe gathering.",
  };
}

function makePassages(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    id: `passage-${i + 1}`,
    text: `Passage ${i + 1} about Lumen temporal accumulation.`,
    courseCode: `LUM10${i + 1}`,
    videoTitle: `Lumen Basics ${i + 1}`,
    timestamp: `${i + 1}:30`,
    source: "transcript",
    similarity: 0.85 - i * 0.1,
    url: "",
    title: "",
    section: "",
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  findCachedDiagnosis.mockResolvedValue({ hit: false });
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

    it("blocks empty queries", async () => {
      const result = await handleProblemFirst(
        { query: "" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(false);
    });
  });

  // ── Cache hit path ──────────────────────────────────────────────

  describe("diagnosis cache hit", () => {
    it("returns cached response immediately when cache hits", async () => {
      const cachedResponse = {
        success: true,
        mode: "problem-first",
        responseType: "ANSWER",
        mostLikelyCause: "Cached cause",
        confidence: "high",
      };
      findCachedDiagnosis.mockResolvedValue({
        hit: true,
        result: cachedResponse,
        similarity: 0.95,
        docId: "cache-doc-1",
      });

      const result = await handleProblemFirst(
        { query: "Lumen GI flickers", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.mostLikelyCause).toBe("Cached cause");
      expect(result._cached).toBe(true);
      expect(result._cacheSimilarity).toBe(0.95);
      expect(result.sessionId).toBe("session-abc");
      // Should NOT call runStage when cache hits
      expect(mockRunStage).not.toHaveBeenCalled();
    });
  });

  // ── Zero-retrieval refusal ─────────────────────────────────────

  describe("zero-retrieval refusal", () => {
    it("returns NEEDS_MORE_CONTEXT when no passages are provided", async () => {
      const result = await handleProblemFirst(
        { query: "Lumen GI flickers", retrievedContext: [] },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.responseType).toBe("NEEDS_MORE_CONTEXT");
      expect(result.refused).toBe(true);
      expect(result.refusalReason).toBe("no_retrieval");
      expect(result.confidence).toBe("NO_DATA_AVAILABLE");
      expect(result.fastChecks).toEqual([]);
      expect(result.fixSteps).toEqual([]);
      expect(mockRunStage).not.toHaveBeenCalled();
    });

    it("returns NEEDS_MORE_CONTEXT when retrievedContext is undefined", async () => {
      const result = await handleProblemFirst(
        { query: "Blueprint compile error" },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.responseType).toBe("NEEDS_MORE_CONTEXT");
      expect(result.refused).toBe(true);
    });

    it("emits retrieval log with refused flag on zero-retrieval", async () => {
      await handleProblemFirst(
        { query: "Niagara crash", retrievedContext: [] },
        fakeContext,
        fakeApiKey
      );

      expect(logRetrieval).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "problem-first",
          flags: { refused: true, reason: "no_passages" },
        })
      );
    });

    it("writes a session even on refusal", async () => {
      const result = await handleProblemFirst(
        { query: "Lumen flickers", retrievedContext: [] },
        fakeContext,
        fakeApiKey
      );

      expect(writeSession).toHaveBeenCalled();
      expect(result.sessionId).toBe("session-abc");
    });
  });

  // ── Full pipeline: ANSWER response ──────────────────────────────

  describe("full pipeline — tutor_answer stage", () => {
    it("returns complete ANSWER response with all expected fields", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      const result = await handleProblemFirst(
        { query: "Lumen GI flickers when camera moves", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.mode).toBe("problem-first");
      expect(result.responseType).toBe("ANSWER");

      // Answer-first fields
      expect(result.mostLikelyCause).toContain("temporal accumulation");
      expect(result.confidence).toBe("high");
      expect(result.howItWorks).toContain("Lumen");
      expect(result.diagram).toMatch(/^flowchart /);
      expect(result.fastChecks).toHaveLength(2);
      expect(result.fixSteps).toHaveLength(3);
      expect(result.ifStillBrokenBranches).toHaveLength(2);
      expect(result.whyThisResult).toHaveLength(2);

      // Learn path
      expect(result.learnPath).toBeDefined();
      expect(result.learnPath.pathSummary).toContain("Lumen GI");
      expect(result.learnPath.objectives.transferable).toHaveLength(2);
      expect(result.learnPath.objectives.fixSpecific).toHaveLength(2);

      // Legacy cart shim
      expect(result.cart).toBeDefined();
      expect(result.cart.mode).toBe("problem-first");
      expect(result.cart.intent.systems).toEqual(["Lumen", "Camera"]);
      expect(result.cart.diagnosis.root_causes).toHaveLength(1);
      expect(result.cart.objectives.fix_specific).toHaveLength(2);
    });

    it("calls runStage exactly once with tutor_answer stage", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      await handleProblemFirst(
        { query: "Lumen GI flickers", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      expect(mockRunStage).toHaveBeenCalledTimes(1);
      const stageArgs = mockRunStage.mock.calls[0][0];
      expect(stageArgs.stage).toBe("tutor_answer");
      expect(stageArgs.systemPrompt).toContain("tutor");
      expect(stageArgs.userPrompt).toContain("Lumen GI flickers");
    });

    it("includes evidence array with citation flags in response", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      const result = await handleProblemFirst(
        { query: "Lumen flickers", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      expect(result.evidence).toBeDefined();
      expect(result.evidence).toHaveLength(2);
      expect(result.evidence[0].courseCode).toBe("LUM101");
      expect(result.evidence[0].ref).toBe(1);
      expect(result.evidence[0].id).toBe("passage-1");
      // Citation validation mock returns valid=[1,2]
      expect(result.citedRefs).toEqual([1, 2]);
      expect(result.invalidCitedRefs).toEqual([]);
    });

    it("includes _meta with citation report and retrieval count", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      const result = await handleProblemFirst(
        { query: "Lumen flickers", retrievedContext: makePassages(3) },
        fakeContext,
        fakeApiKey
      );

      expect(result._meta).toBeDefined();
      expect(result._meta.retrieved_count).toBe(3);
      expect(result._meta.stages_called).toEqual(["tutor_answer"]);
      expect(result._meta.request_id).toBe("trace-123");
    });

    it("calls validateCitations with answer and passages", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      await handleProblemFirst(
        { query: "Lumen flickers", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      expect(validateCitations).toHaveBeenCalledWith(
        expect.objectContaining({ confidence: "high" }),
        expect.arrayContaining([expect.objectContaining({ id: "passage-1" })])
      );
    });

    it("emits retrieval log with refused=false on successful answer", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      await handleProblemFirst(
        { query: "Lumen flickers", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      expect(logRetrieval).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "problem-first",
          flags: { refused: false },
        })
      );
    });
  });

  // ── Off-topic detection ────────────────────────────────────────

  describe("off-topic detection", () => {
    it("returns off_topic when LLM error contains off_topic marker", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: false,
        error: { rawText: 'off_topic: not UE5 related' },
      });

      const result = await handleProblemFirst(
        { query: "How to cook pasta", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("off_topic");
      expect(result.message).toContain("UE5");
    });

    it("returns off_topic when LLM error contains error JSON marker", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: false,
        error: { rawText: '{"error": "off_topic"}' },
      });

      const result = await handleProblemFirst(
        { query: "Python list comprehension", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("off_topic");
    });

    it("returns generic error when LLM fails without off-topic marker", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: false,
        error: "LLM timeout",
      });

      const result = await handleProblemFirst(
        { query: "Blueprint compile error", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("LLM timeout");
    });
  });

  // ── Case report handling ───────────────────────────────────────

  describe("case report handling", () => {
    it("includes sanitized case report fields in the user prompt", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      await handleProblemFirst(
        {
          query: "Lumen flickers",
          retrievedContext: makePassages(),
          caseReport: {
            engineVersion: "5.3",
            platform: "Windows",
            renderer: "Deferred",
            errorStrings: ["GI flicker"],
            whatChangedRecently: "Updated to UE 5.3",
          },
        },
        fakeContext,
        fakeApiKey
      );

      const stageArgs = mockRunStage.mock.calls[0][0];
      expect(stageArgs.userPrompt).toContain("5.3");
      expect(stageArgs.userPrompt).toContain("Windows");
      expect(stageArgs.userPrompt).toContain("Deferred");
    });

    it("includes exclusions as 'already tried' in the prompt", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      await handleProblemFirst(
        {
          query: "Lumen flickers",
          retrievedContext: makePassages(),
          caseReport: {
            exclusions: ["Restarting editor", "Clearing shader cache"],
          },
        },
        fakeContext,
        fakeApiKey
      );

      const stageArgs = mockRunStage.mock.calls[0][0];
      expect(stageArgs.userPrompt).toContain("Already tried");
      expect(stageArgs.userPrompt).toContain("Restarting editor");
    });

    it("handles null caseReport gracefully", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      const result = await handleProblemFirst(
        { query: "Lumen flickers", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
    });
  });

  // ── Passage sanitization ───────────────────────────────────────

  describe("passage sanitization", () => {
    it("caps passages to MAX_PASSAGES (10)", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      const result = await handleProblemFirst(
        { query: "Lumen flickers", retrievedContext: makePassages(15) },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.evidence).toHaveLength(10);
    });

    it("preserves passage IDs through the pipeline", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      const result = await handleProblemFirst(
        { query: "Lumen flickers", retrievedContext: makePassages(3) },
        fakeContext,
        fakeApiKey
      );

      expect(result.evidence[0].id).toBe("passage-1");
      expect(result.evidence[1].id).toBe("passage-2");
      expect(result.evidence[2].id).toBe("passage-3");
    });
  });

  // ── UEFN engine variant ────────────────────────────────────────

  describe("UEFN engine variant", () => {
    it("uses UEFN guardrail when engine=UEFN", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      await handleProblemFirst(
        { query: "Verse script error", retrievedContext: makePassages(), engine: "UEFN" },
        fakeContext,
        fakeApiKey
      );

      const stageArgs = mockRunStage.mock.calls[0][0];
      expect(stageArgs.systemPrompt).toContain("UEFN");
      expect(stageArgs.systemPrompt).toContain("Verse");
    });
  });

  // ── Edge cases: graceful degradation ───────────────────────────

  describe("graceful degradation", () => {
    it("handles missing optional fields in LLM answer", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: {
          systems: ["Lumen"],
          mostLikelyCause: "Unknown cause",
          confidence: "low",
          // Missing: fastChecks, fixSteps, ifStillBroken, objectives, pathSummary
        },
      });

      const result = await handleProblemFirst(
        { query: "Lumen flickers", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      expect(result.success).toBe(true);
      expect(result.responseType).toBe("ANSWER");
      expect(result.howItWorks).toBe("");
      expect(result.diagram).toBe("");
      expect(result.fastChecks).toEqual([]);
      expect(result.fixSteps).toEqual([]);
      expect(result.ifStillBrokenBranches).toEqual([]);
      expect(result.whyThisResult).toEqual([]);
      expect(result.learnPath.pathSummary).toBe("");
      expect(result.learnPath.objectives.transferable).toEqual([]);
    });

    it("handles epic_docs source passages in evidence block", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      const epicPassages = [
        {
          id: "doc-1",
          text: "Lumen uses software ray tracing",
          source: "epic_docs",
          title: "Lumen Technical Reference",
          section: "Architecture Overview",
          similarity: 0.9,
        },
      ];

      await handleProblemFirst(
        { query: "Lumen architecture", retrievedContext: epicPassages },
        fakeContext,
        fakeApiKey
      );

      const stageArgs = mockRunStage.mock.calls[0][0];
      expect(stageArgs.userPrompt).toContain("Lumen Technical Reference");
      expect(stageArgs.userPrompt).toContain("Architecture Overview");
    });

    it("handles cache check failure gracefully (continues to LLM)", async () => {
      findCachedDiagnosis.mockRejectedValue(new Error("Firestore timeout"));
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      const result = await handleProblemFirst(
        { query: "Lumen flickers", retrievedContext: makePassages() },
        fakeContext,
        fakeApiKey
      );

      // Should still succeed via LLM path
      expect(result.success).toBe(true);
      expect(result.responseType).toBe("ANSWER");
    });
  });

  // ── Session writes ─────────────────────────────────────────────

  describe("session writes", () => {
    it("writes session on ANSWER and returns sessionId", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      const result = await handleProblemFirst(
        { query: "Lumen flickers", retrievedContext: makePassages(), sessionId: "custom-session" },
        fakeContext,
        fakeApiKey
      );

      expect(writeSession).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: "test-user-456",
          mode: "problemFirst",
          sessionId: "custom-session",
        })
      );
      expect(result.sessionId).toBe("session-abc");
    });
  });

  // ── Tag detection passthrough ──────────────────────────────────

  describe("tag detection passthrough", () => {
    it("includes detected tags in user prompt", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      await handleProblemFirst(
        {
          query: "Lumen flickers",
          retrievedContext: makePassages(),
          detectedTagIds: ["lumen_gi", "camera_movement"],
        },
        fakeContext,
        fakeApiKey
      );

      const stageArgs = mockRunStage.mock.calls[0][0];
      expect(stageArgs.userPrompt).toContain("lumen_gi");
      expect(stageArgs.userPrompt).toContain("camera_movement");
    });

    it("passes detected tags into the cart shim", async () => {
      mockRunStage.mockResolvedValueOnce({
        success: true,
        data: makeTutorAnswerData(),
      });

      const result = await handleProblemFirst(
        {
          query: "Lumen flickers",
          retrievedContext: makePassages(),
          detectedTagIds: ["lumen_gi"],
        },
        fakeContext,
        fakeApiKey
      );

      expect(result.cart.diagnosis.matched_tag_ids).toEqual(["lumen_gi"]);
    });
  });
});
