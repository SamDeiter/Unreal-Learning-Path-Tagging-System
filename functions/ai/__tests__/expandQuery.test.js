/**
 * Tests for expandQuery.js — cache behavior, eviction, and error handling.
 */

// Mock firebase-functions
jest.mock("firebase-functions", () => ({
  runWith: () => ({
    https: {
      onCall: (handler) => handler,
    },
  }),
  config: () => ({ gemini: { api_key: "test-key" } }),
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

// Mock global fetch
global.fetch = jest.fn();

// Set API key
process.env.GEMINI_API_KEY = "test-key";

function makeContext() {
  return { auth: { uid: "test-user" }, app: {} };
}

function mockGeminiResponse(expansions) {
  global.fetch.mockResolvedValue({
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
  // Re-require for each test to reset module-level cache
  let expandQuery;

  beforeEach(() => {
    jest.resetModules();

    // Re-apply all mocks after resetModules
    jest.mock("firebase-functions", () => ({
      runWith: () => ({
        https: {
          onCall: (handler) => handler,
        },
      }),
      config: () => ({ gemini: { api_key: "test-key" } }),
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

    global.fetch = jest.fn();
    process.env.GEMINI_API_KEY = "test-key";

    expandQuery = require("../expandQuery").expandQuery;
  });

  test("returns expansions from Gemini", async () => {
    mockGeminiResponse(["variant 1", "variant 2", "variant 3"]);

    const result = await expandQuery({ query: "lumen reflections" }, makeContext());
    expect(result.success).toBe(true);
    expect(result.expansions).toHaveLength(3);
    expect(result.expansions).toContain("variant 1");
  });

  test("returns cached result on second call", async () => {
    mockGeminiResponse(["cached variant"]);

    await expandQuery({ query: "same query" }, makeContext());
    const result = await expandQuery({ query: "same query" }, makeContext());

    expect(result.cached).toBe(true);
    expect(result.expansions).toContain("cached variant");
    // fetch should only be called once (second call hits cache)
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Server Error",
    });

    const result = await expandQuery({ query: "api error" }, makeContext());
    expect(result.success).toBe(true);
    expect(result.expansions).toEqual([]);
  });

  test("returns empty expansions on network failure", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"));

    const result = await expandQuery({ query: "network fail" }, makeContext());
    expect(result.success).toBe(true);
    expect(result.expansions).toEqual([]);
  });

  test("returns empty expansions on unparseable response", async () => {
    global.fetch.mockResolvedValue({
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
});
