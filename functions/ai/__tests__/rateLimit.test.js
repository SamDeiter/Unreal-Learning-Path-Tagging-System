const { checkRateLimits } = require("../../utils/rateLimit");

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const mockGet = jest.fn();
  return {
    firestore: () => ({
      collection: () => ({
        where: () => ({
          where: () => ({
            get: mockGet,
          }),
        }),
      }),
    }),
    __mockGet: mockGet,
  };
});

const admin = require("firebase-admin");

describe("checkRateLimits", () => {
  beforeEach(() => {
    admin.__mockGet.mockReset();
  });

  it("allows requests under the per-type limit", async () => {
    admin.__mockGet.mockResolvedValue({
      size: 5,
      docs: [
        { data: () => ({ type: "generation" }) },
        { data: () => ({ type: "generation" }) },
        { data: () => ({ type: "generation" }) },
      ],
    });

    const result = await checkRateLimits("user1", "generation");
    expect(result.allowed).toBe(true);
  });

  it("blocks when per-type limit is exceeded", async () => {
    const docs = Array(15)
      .fill(null)
      .map(() => ({ data: () => ({ type: "generation" }) }));

    admin.__mockGet.mockResolvedValue({ size: 15, docs });

    const result = await checkRateLimits("user1", "generation");
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("15");
  });

  it("blocks when global limit is exceeded", async () => {
    const docs = Array(60)
      .fill(null)
      .map((_, i) => ({ data: () => ({ type: `type${i % 10}` }) }));

    admin.__mockGet.mockResolvedValue({ size: 60, docs });

    const result = await checkRateLimits("user1", "generation");
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("Global");
  });

  it("allows request when Firestore query fails (index building)", async () => {
    admin.__mockGet.mockRejectedValue(new Error("Index not found"));

    const result = await checkRateLimits("user1", "generation");
    expect(result.allowed).toBe(true);
  });

  it("uses default limit of 15 for unknown type", async () => {
    const docs = Array(15)
      .fill(null)
      .map(() => ({ data: () => ({ type: "unknownType" }) }));

    admin.__mockGet.mockResolvedValue({ size: 15, docs });

    const result = await checkRateLimits("user1", "unknownType");
    expect(result.allowed).toBe(false);
  });

  it("counts only matching type for per-type limit", async () => {
    // 14 generation + 10 other types = 24 total, under global (60)
    // 14 generation is under per-type (15)
    const docs = [
      ...Array(14).fill(null).map(() => ({ data: () => ({ type: "generation" }) })),
      ...Array(10).fill(null).map(() => ({ data: () => ({ type: "classifySegments" }) })),
    ];

    admin.__mockGet.mockResolvedValue({ size: 24, docs });

    const result = await checkRateLimits("user1", "generation");
    expect(result.allowed).toBe(true);
  });
});
