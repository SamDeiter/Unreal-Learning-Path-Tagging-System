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

const { writeSession } = require("../sessions");

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
