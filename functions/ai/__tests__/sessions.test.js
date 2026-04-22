/**
 * sessions.test.js — unit tests for writeSession.
 */

const mockDocSet = jest.fn();
const mockDocId = "generated-session-id";
const mockGeneratedDocRef = { id: mockDocId };

jest.mock("firebase-admin", () => {
  const sessionsRef = {
    doc: jest.fn((id) => {
      if (id === undefined) return mockGeneratedDocRef;
      return { id, set: mockDocSet };
    }),
  };
  // Re-wire after creation so doc() without args returns an object
  // that also has set() (for the explicit sessionId path).
  sessionsRef.doc = jest.fn((id) => {
    if (id === undefined) {
      return { id: mockDocId };
    }
    return { id, set: mockDocSet };
  });

  const firestoreFn = jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        collection: jest.fn(() => sessionsRef),
      })),
    })),
  }));

  return { firestore: firestoreFn, __sessionsRef: sessionsRef };
});

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "SERVER_TS"),
  },
}));

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { writeSession, summarizeSession } = require("../sessions");

describe("writeSession", () => {
  beforeEach(() => {
    mockDocSet.mockReset();
    mockDocSet.mockResolvedValue(undefined);
  });

  it("returns null when uid is missing", async () => {
    const id = await writeSession({ mode: "problem-first", query: "hi" });
    expect(id).toBeNull();
  });

  it("writes with server timestamps on new session (no sessionId)", async () => {
    const id = await writeSession({
      uid: "user-1",
      mode: "problem-first",
      query: "lumen flicker",
      conversationHistory: [{ role: "user", content: "x" }],
      result: { foo: "bar" },
    });
    expect(id).toBe(mockDocId);
    expect(mockDocSet).toHaveBeenCalledTimes(1);
    const [payload, opts] = mockDocSet.mock.calls[0];
    expect(payload).toMatchObject({
      uid: "user-1",
      mode: "problem-first",
      query: "lumen flicker",
      createdAt: "SERVER_TS",
      updatedAt: "SERVER_TS",
    });
    expect(opts).toBeUndefined();
  });

  it("merges on existing sessionId (no createdAt)", async () => {
    const id = await writeSession({
      uid: "user-1",
      mode: "goal-build",
      query: "learn ue5",
      sessionId: "abc-123",
    });
    expect(id).toBe("abc-123");
    expect(mockDocSet).toHaveBeenCalledTimes(1);
    const [payload, opts] = mockDocSet.mock.calls[0];
    expect(payload.updatedAt).toBe("SERVER_TS");
    expect(payload.createdAt).toBeUndefined();
    expect(opts).toEqual({ merge: true });
  });

  it("swallows Firestore errors and returns null", async () => {
    mockDocSet.mockRejectedValueOnce(new Error("nope"));
    const id = await writeSession({
      uid: "user-1",
      mode: "problem-first",
      query: "q",
    });
    expect(id).toBeNull();
  });

  it("coerces conversationHistory to array when not an array", async () => {
    const id = await writeSession({
      uid: "user-1",
      mode: "problem-first",
      query: "q",
      conversationHistory: "not-an-array",
    });
    expect(id).toBe(mockDocId);
    const [payload] = mockDocSet.mock.calls[0];
    expect(payload.conversationHistory).toEqual([]);
  });
});

describe("summarizeSession", () => {
  it("returns empty string for null/undefined input", () => {
    expect(summarizeSession(null)).toBe("");
    expect(summarizeSession(undefined)).toBe("");
    expect(summarizeSession({})).toBe("");
  });

  it("returns empty string when session has no result", () => {
    expect(summarizeSession({ id: "abc", result: null })).toBe("");
  });

  it("returns empty string when diagnosis fields are all missing", () => {
    const out = summarizeSession({
      id: "abc123xyz",
      result: { diagnosis: {}, objectives: {} },
    });
    expect(out).toBe("");
  });

  it("builds a complete summary from diagnosis + objectives (happy path)", () => {
    const out = summarizeSession({
      id: "sess12345abcdef",
      result: {
        diagnosis: {
          problem_summary: "Lumen GI flickers when camera moves quickly",
          root_causes: ["Temporal accumulation resets on fast movement"],
        },
        objectives: {
          fix_specific: ["Increase Lumen Final Gather Quality"],
        },
      },
    });
    expect(out).toContain("Prior session (sess1234)");
    expect(out).toContain("Lumen GI flickers when camera moves quickly");
    expect(out).toContain("Root cause identified: Temporal accumulation resets on fast movement");
    expect(out).toContain("Increase Lumen Final Gather Quality");
  });

  it("reads from result.cart.diagnosis/objectives when top-level is absent", () => {
    const out = summarizeSession({
      id: "s1",
      result: {
        cart: {
          diagnosis: {
            problem_summary: "Niagara particles not spawning",
            root_causes: ["Emitter spawn rate set to zero"],
          },
          objectives: {
            fix_specific: ["Set spawn rate > 0"],
          },
        },
      },
    });
    expect(out).toContain("Niagara particles not spawning");
    expect(out).toContain("Emitter spawn rate set to zero");
    expect(out).toContain("Set spawn rate > 0");
  });

  it("omits missing fields gracefully", () => {
    const out = summarizeSession({
      id: "abcdefghij",
      result: {
        diagnosis: { problem_summary: "Shader compile error" },
      },
    });
    expect(out).toContain("Prior session (abcdefgh)");
    expect(out).toContain("Shader compile error");
    expect(out).not.toContain("Root cause");
  });

  it("handles missing session id by dropping the parenthetical", () => {
    const out = summarizeSession({
      result: {
        diagnosis: { problem_summary: "Blueprint crash on BeginPlay" },
      },
    });
    expect(out).toMatch(/^Prior session:/);
    expect(out).toContain("Blueprint crash on BeginPlay");
  });

  it("ignores empty-string and whitespace-only fields", () => {
    const out = summarizeSession({
      id: "s1",
      result: {
        diagnosis: { problem_summary: "   ", root_causes: [""] },
        objectives: { fix_specific: ["  "] },
      },
    });
    expect(out).toBe("");
  });
});
