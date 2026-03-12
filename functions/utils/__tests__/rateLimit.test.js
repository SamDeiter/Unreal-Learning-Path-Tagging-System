/**
 * rateLimit.test.js — Unit tests for rate limiting utilities
 */
const { checkRateLimit, checkGlobalRateLimit, checkRateLimits } = require("../rateLimit");

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const mockGet = jest.fn();
  const mockWhere = jest.fn().mockReturnThis();

  return {
    firestore: jest.fn(() => ({
      collection: jest.fn(() => ({
        where: mockWhere,
        get: mockGet,
      })),
    })),
    _mockGet: mockGet,
    _mockWhere: mockWhere,
  };
});

const admin = require("firebase-admin");

function createMockSnapshot(docs) {
  return {
    size: docs.length,
    docs: docs.map((d) => ({ data: () => d })),
  };
}

describe("rateLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkRateLimits (consolidated)", () => {
    it("allows requests under both limits", async () => {
      admin._mockGet.mockResolvedValueOnce(
        createMockSnapshot([
          { userId: "user1", type: "generation", timestamp: new Date() },
          { userId: "user1", type: "generation", timestamp: new Date() },
        ])
      );

      const result = await checkRateLimits("user1", "generation");
      expect(result.allowed).toBe(true);
    });

    it("blocks when per-type limit exceeded", async () => {
      // Create 15 docs of type "generation"
      const docs = Array.from({ length: 15 }, () => ({
        userId: "user1",
        type: "generation",
        timestamp: new Date(),
      }));
      admin._mockGet.mockResolvedValueOnce(createMockSnapshot(docs));

      const result = await checkRateLimits("user1", "generation");
      expect(result.allowed).toBe(false);
      expect(result.message).toContain("15");
    });

    it("blocks when global limit exceeded", async () => {
      // Create 60 docs across different types
      const docs = Array.from({ length: 60 }, (_, i) => ({
        userId: "user1",
        type: i % 2 === 0 ? "generation" : "classifySegments",
        timestamp: new Date(),
      }));
      admin._mockGet.mockResolvedValueOnce(createMockSnapshot(docs));

      const result = await checkRateLimits("user1", "generation");
      expect(result.allowed).toBe(false);
      expect(result.message).toContain("Global");
    });

    it("allows on Firestore error (index building)", async () => {
      admin._mockGet.mockRejectedValueOnce(new Error("Index not ready"));

      const result = await checkRateLimits("user1", "generation");
      expect(result.allowed).toBe(true);
    });
  });

  describe("Legacy wrappers", () => {
    it("checkRateLimit delegates to checkRateLimits", async () => {
      admin._mockGet.mockResolvedValueOnce(createMockSnapshot([]));

      const result = await checkRateLimit("user1", "generation");
      expect(result.allowed).toBe(true);
    });

    it("checkGlobalRateLimit delegates to checkRateLimits", async () => {
      admin._mockGet.mockResolvedValueOnce(createMockSnapshot([]));

      const result = await checkGlobalRateLimit("user1");
      expect(result.allowed).toBe(true);
    });
  });
});
