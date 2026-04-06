/**
 * Tests for vectorSearch.js — distance conversion, vector validation, and search behavior.
 */

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const mockForEach = jest.fn();
  const mockGet = jest.fn().mockResolvedValue({ forEach: mockForEach });
  const mockFindNearest = jest.fn().mockReturnValue({ get: mockGet });
  const mockCollection = jest.fn().mockReturnValue({ findNearest: mockFindNearest });

  return {
    firestore: () => ({ collection: mockCollection }),
    __mockCollection: mockCollection,
    __mockFindNearest: mockFindNearest,
    __mockGet: mockGet,
    __mockForEach: mockForEach,
  };
});

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { vector: (v) => v },
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: (_opts, handler) => handler,
  HttpsError: class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock("../../utils/rateLimit", () => ({
  checkRateLimits: jest.fn().mockResolvedValue({ allowed: true }),
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

const admin = require("firebase-admin");
// HttpsError available via firebase-functions mock
const {
  vectorSearchEpic,
  vectorSearchCourses,
  vectorSearchSegments,
  vectorSearchDocs,
} = require("../vectorSearch");

// Helper: create a valid 768-dim vector
function makeVector(fill = 0.1) {
  return new Array(768).fill(fill);
}

function makeRequest(queryVector, topK) {
  return {
    auth: { uid: "test-user" },
    data: { queryVector, topK },
    app: {},
  };
}

describe("vectorSearch — vector validation", () => {
  test("rejects null queryVector", async () => {
    await expect(vectorSearchEpic(makeRequest(null))).rejects.toThrow("queryVector is required");
  });

  test("rejects non-array queryVector", async () => {
    await expect(vectorSearchEpic(makeRequest("not-an-array"))).rejects.toThrow(
      "queryVector is required"
    );
  });

  test("rejects wrong dimension (too short)", async () => {
    await expect(vectorSearchEpic(makeRequest([1, 2, 3]))).rejects.toThrow("Expected 768-dim");
  });

  test("rejects wrong dimension (too long)", async () => {
    const vec = new Array(1024).fill(0.1);
    await expect(vectorSearchEpic(makeRequest(vec))).rejects.toThrow("Expected 768-dim");
  });

  test("rejects vector containing NaN", async () => {
    const vec = makeVector();
    vec[100] = NaN;
    await expect(vectorSearchEpic(makeRequest(vec))).rejects.toThrow("NaN or Infinity");
  });

  test("rejects vector containing Infinity", async () => {
    const vec = makeVector();
    vec[0] = Infinity;
    await expect(vectorSearchEpic(makeRequest(vec))).rejects.toThrow("NaN or Infinity");
  });

  test("rejects vector containing -Infinity", async () => {
    const vec = makeVector();
    vec[500] = -Infinity;
    await expect(vectorSearchEpic(makeRequest(vec))).rejects.toThrow("NaN or Infinity");
  });

  test("accepts valid 768-dim vector", async () => {
    admin.__mockForEach.mockImplementation(() => {});
    const result = await vectorSearchEpic(makeRequest(makeVector()));
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("count");
  });
});

describe("vectorSearch — distance-to-similarity conversion", () => {
  function setupMockDocs(distances) {
    admin.__mockForEach.mockImplementation((callback) => {
      distances.forEach((dist, i) => {
        callback({
          id: `doc_${i}`,
          data: () => ({
            embedding: makeVector(),
            vector_distance: dist,
            title: `Doc ${i}`,
          }),
        });
      });
    });
  }

  test("distance 0 → similarity 1 (identical)", async () => {
    setupMockDocs([0]);
    const result = await vectorSearchEpic(makeRequest(makeVector()));
    expect(result.results[0].similarity).toBe(1);
  });

  test("distance 0.5 → similarity 0.75", async () => {
    setupMockDocs([0.5]);
    const result = await vectorSearchEpic(makeRequest(makeVector()));
    expect(result.results[0].similarity).toBe(0.75);
  });

  test("distance 1.0 → similarity 0.5 (orthogonal)", async () => {
    setupMockDocs([1.0]);
    const result = await vectorSearchEpic(makeRequest(makeVector()));
    expect(result.results[0].similarity).toBe(0.5);
  });

  test("distance 1.5 → similarity 0.25", async () => {
    setupMockDocs([1.5]);
    const result = await vectorSearchEpic(makeRequest(makeVector()));
    expect(result.results[0].similarity).toBe(0.25);
  });

  test("distance 2.0 → similarity 0 (opposite)", async () => {
    setupMockDocs([2.0]);
    const result = await vectorSearchEpic(makeRequest(makeVector()));
    expect(result.results[0].similarity).toBe(0);
  });

  test("null distance → similarity 0", async () => {
    setupMockDocs([null]);
    const result = await vectorSearchEpic(makeRequest(makeVector()));
    expect(result.results[0].similarity).toBe(0);
  });

  test("undefined distance → similarity 0", async () => {
    setupMockDocs([undefined]);
    const result = await vectorSearchEpic(makeRequest(makeVector()));
    expect(result.results[0].similarity).toBe(0);
  });
});

describe("vectorSearch — empty results", () => {
  test("returns empty array when no docs match", async () => {
    admin.__mockForEach.mockImplementation(() => {});
    const result = await vectorSearchEpic(makeRequest(makeVector()));
    expect(result.results).toEqual([]);
    expect(result.count).toBe(0);
  });
});

describe("vectorSearch — all endpoints validate", () => {
  const badVec = [1, 2, 3]; // wrong dimension

  test("vectorSearchCourses validates vector", async () => {
    await expect(vectorSearchCourses(makeRequest(badVec))).rejects.toThrow("Expected 768-dim");
  });

  test("vectorSearchSegments validates vector", async () => {
    await expect(vectorSearchSegments(makeRequest(badVec))).rejects.toThrow("Expected 768-dim");
  });

  test("vectorSearchDocs validates vector", async () => {
    await expect(vectorSearchDocs(makeRequest(badVec))).rejects.toThrow("Expected 768-dim");
  });
});

describe("vectorSearch — strips embedding from results", () => {
  test("embedding field is not included in results", async () => {
    admin.__mockForEach.mockImplementation((callback) => {
      callback({
        id: "doc_1",
        data: () => ({
          embedding: makeVector(),
          vector_distance: 0.2,
          title: "Test Course",
          course_code: "101.01",
        }),
      });
    });

    const result = await vectorSearchEpic(makeRequest(makeVector()));
    expect(result.results[0]).not.toHaveProperty("embedding");
    expect(result.results[0].title).toBe("Test Course");
    expect(result.results[0].course_code).toBe("101.01");
  });
});
