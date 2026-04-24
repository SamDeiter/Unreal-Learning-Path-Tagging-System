/**
 * handleProblemFirst.vision.test.js — verifies that a screenshot supplied via
 * caseReport.screenshotBase64 reaches Gemini as an inlineData part, and that
 * absence of a screenshot leaves the call image-free.
 *
 * Mirrors the mock layout of handleProblemFirst.test.js so the two test files
 * stay independently maintainable.
 */

jest.mock("../../utils/authGuard", () => ({
  requireAuth: jest.fn(() => "test-user-vision"),
}));

jest.mock("../../utils/apiUsage", () => ({
  logApiUsage: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../pipeline/telemetry", () => ({
  createTrace: jest.fn(() => ({
    request_id: "trace-vision",
    toLog: jest.fn(),
    toDebugPayload: jest.fn(() => ({})),
  })),
  isAdmin: jest.fn(() => false),
}));

jest.mock("../../pipeline/promptVersions", () => ({
  PROMPT_VERSION: "test-vision-v1",
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
  sanitizeAndValidate: jest.fn((q) => ({ blocked: false, clean: q })),
}));

jest.mock("../../pipeline/queryEmbedding", () => ({
  embedQueryText: jest.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
}));

jest.mock("../../pipeline/citations", () => ({
  validateCitations: jest.fn(() => ({ valid: [], invalid: [], total_cited: 0, uncited: [] })),
}));

jest.mock("../../pipeline/retrievalLog", () => ({
  logRetrieval: jest.fn(),
}));

jest.mock("../sessions", () => ({
  writeSession: jest.fn(() => Promise.resolve("session-vision")),
}));

jest.mock("firebase-admin", () => {
  const mockSet = jest.fn(() => Promise.resolve());
  return {
    firestore: Object.assign(
      jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({ set: mockSet })),
        })),
      })),
      { FieldValue: { serverTimestamp: jest.fn(() => "mock-ts") } }
    ),
  };
});

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockRunStage = jest.fn();
jest.mock("../../pipeline/llmStage", () => ({
  runStage: (...args) => mockRunStage(...args),
}));

const { handleProblemFirst } = require("../handleProblemFirst");

const fakeContext = { auth: { uid: "test-user-vision" } };
const fakeApiKey = "test-key";

function makePassages(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p-${i + 1}`,
    text: `Passage ${i + 1}.`,
    courseCode: `C10${i + 1}`,
    videoTitle: `Video ${i + 1}`,
    timestamp: `${i + 1}:00`,
    source: "transcript",
    similarity: 0.9 - i * 0.1,
  }));
}

function makeAnswer() {
  return {
    systems: ["Lighting"],
    mostLikelyCause: "Stale cache",
    confidence: "med",
    howItWorks: "Some explanation citing [1].",
    diagram: "",
    fastChecks: ["check one"],
    fixSteps: ["step one"],
    ifStillBroken: [{ condition: "still broken", action: "do x" }],
    whyThisResult: ["because [1]"],
    objectives: { fixSpecific: ["a"], transferable: ["Diagnose like a pro by doing things"] },
    pathSummary: "Summary.",
  };
}

const PIXEL_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

beforeEach(() => {
  jest.clearAllMocks();
  mockRunStage.mockResolvedValue({ success: true, data: makeAnswer() });
});

describe("handleProblemFirst — vision (screenshot inline part)", () => {
  it("appends inlineData part when caseReport.screenshotBase64 is present", async () => {
    await handleProblemFirst(
      {
        query: "Why is my Blueprint not compiling?",
        retrievedContext: makePassages(),
        caseReport: {
          screenshotBase64: PIXEL_PNG_B64,
          screenshotMimeType: "image/png",
        },
      },
      fakeContext,
      fakeApiKey
    );

    expect(mockRunStage).toHaveBeenCalledTimes(1);
    const args = mockRunStage.mock.calls[0][0];
    expect(args.imagePart).toBeDefined();
    expect(args.imagePart).toEqual({
      inlineData: { mimeType: "image/png", data: PIXEL_PNG_B64 },
    });
    // Vision call must skip the stage cache to avoid cross-pollination with
    // non-image responses for the same (uid, query, mode, engine) tuple.
    expect(args.cacheParams).toBeNull();
  });

  it("nudges the model to use the screenshot in the user prompt", async () => {
    await handleProblemFirst(
      {
        query: "Lumen flicker on this panel",
        retrievedContext: makePassages(),
        caseReport: {
          screenshotBase64: PIXEL_PNG_B64,
          screenshotMimeType: "image/jpeg",
        },
      },
      fakeContext,
      fakeApiKey
    );

    const args = mockRunStage.mock.calls[0][0];
    expect(args.userPrompt).toMatch(/screenshot/i);
  });

  it("passes imagePart=null when no screenshot is present", async () => {
    await handleProblemFirst(
      { query: "Plain query", retrievedContext: makePassages() },
      fakeContext,
      fakeApiKey
    );

    expect(mockRunStage).toHaveBeenCalledTimes(1);
    const args = mockRunStage.mock.calls[0][0];
    expect(args.imagePart).toBeNull();
    // Cache key remains intact for non-image queries.
    expect(args.cacheParams).toEqual(
      expect.objectContaining({ mode: "problem-first" })
    );
  });

  it("passes imagePart=null when caseReport is provided without screenshot fields", async () => {
    await handleProblemFirst(
      {
        query: "Engine setup question",
        retrievedContext: makePassages(),
        caseReport: { engineVersion: "5.4", platform: "Windows" },
      },
      fakeContext,
      fakeApiKey
    );

    const args = mockRunStage.mock.calls[0][0];
    expect(args.imagePart).toBeNull();
  });

  it("rejects screenshots with a disallowed mime type", async () => {
    await handleProblemFirst(
      {
        query: "Suspicious upload",
        retrievedContext: makePassages(),
        caseReport: {
          screenshotBase64: PIXEL_PNG_B64,
          screenshotMimeType: "application/octet-stream",
        },
      },
      fakeContext,
      fakeApiKey
    );

    const args = mockRunStage.mock.calls[0][0];
    expect(args.imagePart).toBeNull();
  });

  it("rejects oversized screenshots (> ~5MB base64) without crashing", async () => {
    // 5 * 1024 * 1024 + 1 chars — just past the cap.
    const huge = "A".repeat(5 * 1024 * 1024 + 1);

    await handleProblemFirst(
      {
        query: "Big upload",
        retrievedContext: makePassages(),
        caseReport: { screenshotBase64: huge, screenshotMimeType: "image/png" },
      },
      fakeContext,
      fakeApiKey
    );

    const args = mockRunStage.mock.calls[0][0];
    expect(args.imagePart).toBeNull();
  });
});
