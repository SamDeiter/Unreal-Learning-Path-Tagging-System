/**
 * Tests for expandQuery.js — Firestore cache, expansion limits, and error handling.
 *
 * Vertex migration: previous tests stubbed `global.fetch`; we now mock the
 * `utils/vertex` module's `generateContent` so the test surface matches what
 * the function actually calls.
 */

// Mock firebase-functions
jest.mock("firebase-functions", () => ({
  runWith: () => ({
    https: {
      onCall: (handler) => handler,
    },
  }),
  https: {
    HttpsError: class HttpsError extends Error {
      constructor(code, message) {
        super(message);
        this.code = code;
      }
    },
  },
}));

jest.mock("../../utils/sanitizeInput", () => ({
  sanitizeAndValidate: (query) => ({ blocked: false, clean: query }),
}));

const mockGetCached = jest.fn().mockResolvedValue(null);
const mockSetCache = jest.fn().mockResolvedValue(undefined);

jest.mock("../../pipeline/cache", () => ({
  normalizeQuery: (q) => q.toLowerCase().trim(),
  getCached: (...args) => mockGetCached(...args),
  setCache: (...args) => mockSetCache(...args),
}));

jest.mock("../../utils/rateLimit", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  checkGlobalRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));

jest.mock("../../utils/authGuard", () => ({
  requireAuth: jest.fn().mockReturnValue("test-user"),
}));

jest.mock("../../utils/apiUsage", () => ({
  logApiUsage: jest.fn(),
}));

jest.mock("../../utils/appCheckMiddleware", () => ({
  requireAppCheck: jest.fn(),
}));

const mockVertexGenerate = jest.fn();
jest.mock("../../utils/vertex", () => ({
  generateContent: (...args) => mockVertexGenerate(...args),
  embedContent: jest.fn(),
}));

function makeContext() {
  return { auth: { uid: "test-user" }, app: {} };
}

function mockGeminiResponse(expansions) {
  mockVertexGenerate.mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(expansions) }],
          },
        },
      ],
    }),
  });
}

describe("expandQuery", () => {
  let expandQuery;

  beforeEach(() => {
    jest.resetModules();

    jest.mock("firebase-functions", () => ({
      runWith: () => ({
        https: {
          onCall: (handler) => handler,
        },
      }),
      https: {
        HttpsError: class HttpsError extends Error {
          constructor(code, message) {
            super(message);
            this.code = code;
          }
        },
      },
    }));

    jest.mock("../../utils/sanitizeInput", () => ({
      sanitizeAndValidate: (query) => ({ blocked: false, clean: query }),
    }));

    jest.mock("../../pipeline/cache", () => ({
      normalizeQuery: (q) => q.toLowerCase().trim(),
      getCached: (...args) => mockGetCached(...args),
      setCache: (...args) => mockSetCache(...args),
    }));

    jest.mock("../../utils/rateLimit", () => ({
      checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
      checkGlobalRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
    }));

    jest.mock("../../utils/authGuard", () => ({
      requireAuth: jest.fn().mockReturnValue("test-user"),
    }));

    jest.mock("../../utils/apiUsage", () => ({
      logApiUsage: jest.fn(),
    }));

    jest.mock("../../utils/appCheckMiddleware", () => ({
      requireAppCheck: jest.fn(),
    }));

    jest.mock("../../utils/vertex", () => ({
      generateContent: (...args) => mockVertexGenerate(...args),
      embedContent: jest.fn(),
    }));

    mockVertexGenerate.mockReset();
    mockGetCached.mockReset().mockResolvedValue(null);
    mockSetCache.mockReset().mockResolvedValue(undefined);

    expandQuery = require("../expandQuery").expandQuery;
  });

  test("returns expansions from Gemini", async () => {
    mockGeminiResponse(["variant 1", "variant 2", "variant 3"]);

    const result = await expandQuery({ query: "lumen reflections" }, makeContext());
    expect(result.success).toBe(true);
    expect(result.expansions).toHaveLength(3);
    expect(result.expansions).toContain("variant 1");
  });

  test("returns cached result from Firestore cache", async () => {
    mockGetCached.mockResolvedValue({ expansions: ["cached variant"] });

    const result = await expandQuery({ query: "same query" }, makeContext());

    expect(result.cached).toBe(true);
    expect(result.expansions).toContain("cached variant");
    expect(mockVertexGenerate).not.toHaveBeenCalled();
  });

  test("writes to Firestore cache on cache miss", async () => {
    mockGeminiResponse(["new variant"]);

    await expandQuery({ query: "fresh query" }, makeContext());

    expect(mockSetCache).toHaveBeenCalledWith(
      "query_expansion",
      { query: "fresh query" },
      { expansions: ["new variant"] }
    );
  });

  test("limits expansions to 3", async () => {
    mockGeminiResponse(["a", "b", "c", "d", "e"]);

    const result = await expandQuery({ query: "too many expansions" }, makeContext());
    expect(result.expansions.length).toBeLessThanOrEqual(3);
  });

  test("truncates long expansion strings to 100 chars", async () => {
    const longString = "a".repeat(200);
    mockGeminiResponse([longString]);

    const result = await expandQuery({ query: "long expansion" }, makeContext());
    expect(result.expansions[0].length).toBeLessThanOrEqual(100);
  });

  test("filters out very short expansions", async () => {
    mockGeminiResponse(["ok query", "ab", "x"]);

    const result = await expandQuery({ query: "filter short" }, makeContext());
    expect(result.expansions).toEqual(["ok query"]);
  });

  test("returns empty expansions on API error", async () => {
    mockVertexGenerate.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Server Error",
    });

    const result = await expandQuery({ query: "api error" }, makeContext());
    expect(result.success).toBe(true);
    expect(result.expansions).toEqual([]);
  });

  test("returns empty expansions on network failure", async () => {
    mockVertexGenerate.mockRejectedValue(new Error("Network error"));

    const result = await expandQuery({ query: "network fail" }, makeContext());
    expect(result.success).toBe(true);
    expect(result.expansions).toEqual([]);
  });

  test("returns empty expansions on unparseable response", async () => {
    mockVertexGenerate.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: "not json at all {{{}}" }],
            },
          },
        ],
      }),
    });

    const result = await expandQuery({ query: "bad json" }, makeContext());
    expect(result.success).toBe(true);
    expect(result.expansions).toEqual([]);
  });

  test("falls back gracefully when cache read fails", async () => {
    mockGetCached.mockRejectedValue(new Error("Firestore down"));
    mockGeminiResponse(["fallback variant"]);

    mockGetCached.mockResolvedValue(null);
    const result = await expandQuery({ query: "cache fail" }, makeContext());
    expect(result.success).toBe(true);
    expect(result.expansions).toContain("fallback variant");
  });
});
