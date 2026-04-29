/**
 * Tests for rerankPassages.js — scoring, sorting, fallback, and Discovery
 * Engine request shape.
 *
 * Migrated 2026-04-29 from Gemini-as-cross-encoder mocking (vertex.generateContent)
 * to Vertex Discovery Engine semantic-ranker-default mocking. The handler now
 * calls Discovery Engine via raw fetch using a token from utils/vertex.getAccessToken,
 * so we mock both: getAccessToken (returns a fake token) and global.fetch (returns
 * the Discovery Engine response shape).
 */

const mockOnCall = jest.fn();
jest.mock("firebase-functions", () => ({
  runWith: () => ({
    https: {
      onCall: (handler) => {
        mockOnCall.mockImplementation(handler);
        return handler;
      },
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
  getAccessToken: jest.fn().mockResolvedValue("fake-token"),
  PROJECT_ID: "development-317819",
  // Keep these so anything else that imports vertex doesn't break.
  generateContent: jest.fn(),
  embedContent: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const { rerankPassages } = require("../rerankPassages");

function makeContext() {
  return { auth: { uid: "test-user" }, app: {} };
}

// Helper — build a Discovery Engine ranker response from a list of {id, score}.
function rankerResponse(records) {
  return {
    ok: true,
    json: async () => ({ records }),
    text: async () => JSON.stringify({ records }),
  };
}

describe("rerankPassages (Discovery Engine semantic-ranker-default)", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("returns empty array for empty passages", async () => {
    const result = await rerankPassages({ query: "test", passages: [] }, makeContext());
    expect(result.success).toBe(true);
    expect(result.reranked).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("returns empty array for non-array passages", async () => {
    const result = await rerankPassages({ query: "test", passages: null }, makeContext());
    expect(result.success).toBe(true);
    expect(result.reranked).toEqual([]);
  });

  test("sorts passages by Discovery Engine scores (0–1 scaled to 0–10)", async () => {
    // Discovery Engine returns records ALREADY sorted by score desc — we just
    // map them back to original passages by id (which is the original index).
    mockFetch.mockResolvedValue(
      rankerResponse([
        { id: "1", score: 0.9 }, // High relevance — was index 1
        { id: "2", score: 0.6 }, // Medium — was index 2
        { id: "0", score: 0.3 }, // Low — was index 0
      ])
    );

    const passages = [
      { text: "Low relevance passage" },
      { text: "High relevance passage" },
      { text: "Medium relevance passage" },
    ];

    const result = await rerankPassages({ query: "test", passages }, makeContext());
    expect(result.success).toBe(true);
    expect(result.reranked[0].text).toBe("High relevance passage");
    expect(result.reranked[1].text).toBe("Medium relevance passage");
    expect(result.reranked[2].text).toBe("Low relevance passage");
    // Score scaled by 10x for caller compatibility.
    expect(result.reranked[0]._rerankScore).toBeCloseTo(9, 5);
    expect(result.reranked[1]._rerankScore).toBeCloseTo(6, 5);
    expect(result.reranked[2]._rerankScore).toBeCloseTo(3, 5);
  });

  test("returns fallback with success: false on fetch error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const passages = [{ text: "A" }, { text: "B" }];
    const result = await rerankPassages({ query: "test", passages }, makeContext());
    expect(result.success).toBe(false);
    expect(result.fallback).toBe(true);
    expect(result.reranked).toHaveLength(2);
    expect(result.error).toBe("Network error");
  });

  test("returns fallback on non-ok Discovery Engine response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const passages = [{ text: "A" }];
    const result = await rerankPassages({ query: "test", passages }, makeContext());
    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.reranked).toEqual([{ text: "A" }]);
  });

  test("appends missing records at the bottom with score 0", async () => {
    // Ranker returns only 1 of 3 records (defensive path).
    mockFetch.mockResolvedValue(rankerResponse([{ id: "1", score: 0.9 }]));

    const passages = [{ text: "A" }, { text: "B" }, { text: "C" }];
    const result = await rerankPassages({ query: "test", passages }, makeContext());
    expect(result.success).toBe(true);
    expect(result.reranked).toHaveLength(3);
    expect(result.reranked[0].text).toBe("B");
    expect(result.reranked[0]._rerankScore).toBeCloseTo(9, 5);
    // Missing records get appended with score 0.
    const trailingScores = result.reranked.slice(1).map((p) => p._rerankScore);
    expect(trailingScores).toEqual([0, 0]);
  });

  test("hits the Discovery Engine ranker with correct body shape", async () => {
    let capturedBody;
    let capturedUrl;
    let capturedHeaders;
    mockFetch.mockImplementation(async (url, init) => {
      capturedUrl = url;
      capturedHeaders = init.headers;
      capturedBody = JSON.parse(init.body);
      return rankerResponse([{ id: "0", score: 0.5 }]);
    });

    const passages = [{ text: "A passage", title: "Title A" }];
    await rerankPassages({ query: "my query", passages }, makeContext());

    expect(capturedUrl).toContain("discoveryengine.googleapis.com");
    expect(capturedUrl).toContain("default_ranking_config:rank");
    expect(capturedHeaders["Authorization"]).toBe("Bearer fake-token");
    expect(capturedHeaders["X-Goog-User-Project"]).toBe("development-317819");
    expect(capturedBody.model).toBe("semantic-ranker-default@latest");
    expect(capturedBody.query).toBe("my query");
    expect(Array.isArray(capturedBody.records)).toBe(true);
    expect(capturedBody.records).toHaveLength(1);
    expect(capturedBody.records[0]).toMatchObject({
      id: "0",
      title: "Title A",
      content: "A passage",
    });
  });

  test("caps passages at 30", async () => {
    let capturedBody;
    mockFetch.mockImplementation(async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      return rankerResponse([]);
    });

    const passages = Array(40)
      .fill(null)
      .map((_, i) => ({ text: `Passage ${i}` }));

    await rerankPassages({ query: "test", passages }, makeContext());
    expect(capturedBody.records).toHaveLength(30);
    expect(capturedBody.records[29].content).toBe("Passage 29");
    expect(capturedBody.records.find((r) => r.content === "Passage 30")).toBeUndefined();
  });

  test("truncates passage content to 4000 chars", async () => {
    let capturedBody;
    mockFetch.mockImplementation(async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      return rankerResponse([{ id: "0", score: 0.5 }]);
    });

    const longText = "x".repeat(10000);
    const passages = [{ text: longText, title: "Long" }];
    await rerankPassages({ query: "test", passages }, makeContext());
    expect(capturedBody.records[0].content.length).toBe(4000);
  });
});
