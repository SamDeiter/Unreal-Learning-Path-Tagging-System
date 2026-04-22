/**
 * feedbackReader.test.js — readLatestFeedback + buildAffectiveDirective.
 *
 * Phase 3 — Affective-Feedback Loop.
 */

// Capture query-builder calls so we can assert on ordering/limit/filter semantics.
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockWhere = jest.fn();
const mockGet = jest.fn();

jest.mock("firebase-admin", () => {
  // Inline the query handle factory — jest.mock() factories may not reference
  // out-of-scope non-mock-prefixed variables.
  function makeHandle() {
    const handle = {};
    handle.orderBy = (...args) => {
      mockOrderBy(...args);
      return handle;
    };
    handle.where = (...args) => {
      mockWhere(...args);
      return handle;
    };
    handle.limit = (...args) => {
      mockLimit(...args);
      return handle;
    };
    handle.get = mockGet;
    return handle;
  }
  const handle = makeHandle();
  return {
    firestore: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          collection: jest.fn(() => handle),
        })),
      })),
    })),
  };
});

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  readLatestFeedback,
  buildAffectiveDirective,
  PRIOR_FEEDBACK_WINDOW_MS,
} = require("../feedbackReader");

function makeSnap(docs) {
  return {
    forEach: (fn) => {
      for (const d of docs) fn(d);
    },
  };
}

function fakeDoc(id, data) {
  return { id, data: () => data };
}

beforeEach(() => {
  mockOrderBy.mockReset();
  mockLimit.mockReset();
  mockWhere.mockReset();
  mockGet.mockReset();
});

describe("PRIOR_FEEDBACK_WINDOW_MS", () => {
  it("is 24 hours in milliseconds", () => {
    expect(PRIOR_FEEDBACK_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("buildAffectiveDirective", () => {
  it("returns '' for null / undefined / non-object", () => {
    expect(buildAffectiveDirective(null)).toBe("");
    expect(buildAffectiveDirective(undefined)).toBe("");
    expect(buildAffectiveDirective("confused")).toBe("");
    expect(buildAffectiveDirective(42)).toBe("");
  });

  it("returns '' for missing or unknown signal", () => {
    expect(buildAffectiveDirective({})).toBe("");
    expect(buildAffectiveDirective({ signal: "" })).toBe("");
    expect(buildAffectiveDirective({ signal: "mystery" })).toBe("");
    expect(buildAffectiveDirective({ signal: 42 })).toBe("");
  });

  it("confused → simpler language + prereqs directive", () => {
    const d = buildAffectiveDirective({ signal: "confused" });
    expect(d).toContain("CONFUSING");
    expect(d).toMatch(/simpler|smaller steps|prerequisite/i);
  });

  it("already_knew → compress + raise altitude directive", () => {
    const d = buildAffectiveDirective({ signal: "already_knew" });
    expect(d).toContain("ALREADY KNOWN");
    expect(d).toMatch(/compress|skip basics|advanced/i);
  });

  it("not_helpful → different angle directive", () => {
    const d = buildAffectiveDirective({ signal: "not_helpful" });
    expect(d).toContain("NOT HELPFUL");
    expect(d).toMatch(/different angle|different analogy|worked example/i);
  });

  it("rejected → same directive as not_helpful", () => {
    const a = buildAffectiveDirective({ signal: "rejected" });
    const b = buildAffectiveDirective({ signal: "not_helpful" });
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("helpful → '' (no overfitting on positives)", () => {
    expect(buildAffectiveDirective({ signal: "helpful" })).toBe("");
  });

  it("completed → '' (no overfitting on positives)", () => {
    expect(buildAffectiveDirective({ signal: "completed" })).toBe("");
  });
});

describe("readLatestFeedback", () => {
  it("returns null when uid is missing", async () => {
    expect(await readLatestFeedback()).toBeNull();
    expect(await readLatestFeedback("")).toBeNull();
    expect(await readLatestFeedback(42)).toBeNull();
  });

  it("returns [] for missing uid when limit > 1", async () => {
    expect(await readLatestFeedback(null, { limit: 5 })).toEqual([]);
  });

  it("issues orderBy(createdAt, desc) and limit", async () => {
    mockGet.mockResolvedValue(makeSnap([]));
    await readLatestFeedback("uid-1");
    expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(mockLimit).toHaveBeenCalled();
    expect(mockWhere).not.toHaveBeenCalled();
  });

  it("applies sessionId where() filter when provided", async () => {
    mockGet.mockResolvedValue(makeSnap([]));
    await readLatestFeedback("uid-1", { sessionId: "sess-abc" });
    expect(mockWhere).toHaveBeenCalledWith("sessionId", "==", "sess-abc");
  });

  it("returns the first fresh doc when limit=1 (default)", async () => {
    const now = Date.now();
    mockGet.mockResolvedValue(
      makeSnap([
        fakeDoc("fb-1", {
          signal: "confused",
          sessionId: "s",
          createdAt: now - 60_000, // 1 minute ago
        }),
      ])
    );
    const res = await readLatestFeedback("uid-1");
    expect(res).not.toBeNull();
    expect(res.id).toBe("fb-1");
    expect(res.signal).toBe("confused");
  });

  it("filters out stale entries older than PRIOR_FEEDBACK_WINDOW_MS", async () => {
    const now = Date.now();
    const stale = now - (PRIOR_FEEDBACK_WINDOW_MS + 60_000);
    mockGet.mockResolvedValue(
      makeSnap([
        fakeDoc("old", { signal: "confused", createdAt: stale }),
      ])
    );
    const res = await readLatestFeedback("uid-1");
    expect(res).toBeNull();
  });

  it("returns the next fresh doc if the first is stale", async () => {
    const now = Date.now();
    const stale = now - (PRIOR_FEEDBACK_WINDOW_MS + 60_000);
    mockGet.mockResolvedValue(
      makeSnap([
        fakeDoc("old", { signal: "helpful", createdAt: stale }),
        fakeDoc("fresh", { signal: "confused", createdAt: now - 1000 }),
      ])
    );
    const res = await readLatestFeedback("uid-1");
    expect(res.id).toBe("fresh");
    expect(res.signal).toBe("confused");
  });

  it("supports Firestore timestamp objects via toMillis()", async () => {
    const now = Date.now();
    mockGet.mockResolvedValue(
      makeSnap([
        fakeDoc("ts", {
          signal: "confused",
          createdAt: { toMillis: () => now - 500 },
        }),
      ])
    );
    const res = await readLatestFeedback("uid-1");
    expect(res).not.toBeNull();
    expect(res.id).toBe("ts");
  });

  it("returns null on Firestore error (defensive)", async () => {
    mockGet.mockRejectedValue(new Error("firestore down"));
    const res = await readLatestFeedback("uid-1");
    expect(res).toBeNull();
  });

  it("returns array (possibly multiple) when limit > 1", async () => {
    const now = Date.now();
    mockGet.mockResolvedValue(
      makeSnap([
        fakeDoc("a", { signal: "confused", createdAt: now - 100 }),
        fakeDoc("b", { signal: "helpful", createdAt: now - 200 }),
      ])
    );
    const res = await readLatestFeedback("uid-1", { limit: 3 });
    expect(Array.isArray(res)).toBe(true);
    expect(res).toHaveLength(2);
    expect(res[0].id).toBe("a");
  });
});
