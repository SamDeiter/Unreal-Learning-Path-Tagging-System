/**
 * submitFeedback.test.js — callable handler tests.
 */

const mockFeedbackSet = jest.fn(() => Promise.resolve());
const mockFeedbackId = "feedback-abc";

jest.mock("firebase-admin", () => {
  const firestore = jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({ id: mockFeedbackId, set: mockFeedbackSet })),
        })),
      })),
    })),
  }));
  firestore.FieldValue = {
    serverTimestamp: jest.fn(() => "SERVER_TS"),
  };
  return { firestore };
});

jest.mock("firebase-functions", () => {
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const runWith = jest.fn(() => ({
    https: {
      onCall: (handler) => handler,
    },
  }));
  return {
    runWith,
    https: { HttpsError },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
});

jest.mock("../../utils/appCheckMiddleware", () => ({
  requireAppCheck: jest.fn(),
}));

const mockApplySkillSignals = jest.fn(() => Promise.resolve());
jest.mock("../skillStateWriter", () => ({
  applySkillSignals: (...args) => mockApplySkillSignals(...args),
}));

const { submitFeedback } = require("../submitFeedback");

const authCtx = { auth: { uid: "user-1" }, app: {} };
const noAuthCtx = { auth: null, app: {} };

describe("submitFeedback callable", () => {
  beforeEach(() => {
    mockFeedbackSet.mockClear();
    mockFeedbackSet.mockResolvedValue(undefined);
    mockApplySkillSignals.mockClear();
  });

  it("rejects unauthenticated calls", async () => {
    await expect(
      submitFeedback({ sessionId: "s1", signal: "helpful" }, noAuthCtx)
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects missing sessionId", async () => {
    await expect(
      submitFeedback({ signal: "helpful" }, authCtx)
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects invalid signal", async () => {
    await expect(
      submitFeedback({ sessionId: "s1", signal: "bogus" }, authCtx)
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("writes feedback doc with the correct fields and returns { success, feedbackId }", async () => {
    const out = await submitFeedback(
      {
        sessionId: "sess-42",
        signal: "helpful",
        tagsTouched: ["lumen", "nanite"],
        comment: "ok",
      },
      authCtx
    );
    expect(out).toEqual({ success: true, feedbackId: mockFeedbackId });
    expect(mockFeedbackSet).toHaveBeenCalledTimes(1);
    const payload = mockFeedbackSet.mock.calls[0][0];
    expect(payload).toMatchObject({
      uid: "user-1",
      sessionId: "sess-42",
      signal: "helpful",
      tagsTouched: ["lumen", "nanite"],
      comment: "ok",
      createdAt: "SERVER_TS",
    });
  });

  it("'helpful' writes feedback but makes no skill call", async () => {
    await submitFeedback(
      { sessionId: "s1", signal: "helpful", tagsTouched: ["lumen"] },
      authCtx
    );
    expect(mockFeedbackSet).toHaveBeenCalled();
    expect(mockApplySkillSignals).not.toHaveBeenCalled();
  });

  // Data-driven: signal → mapped skill signal name
  const signalMatrix = [
    { signal: "already_knew", expected: "mastered" },
    { signal: "completed", expected: "completed" },
    { signal: "confused", expected: "struggled" },
    { signal: "rejected", expected: "rejected" },
    { signal: "not_helpful", expected: "rejected" },
  ];

  signalMatrix.forEach(({ signal, expected }) => {
    it(`maps '${signal}' → '${expected}' skill signal`, async () => {
      await submitFeedback(
        { sessionId: "s1", signal, tagsTouched: ["lumen"] },
        authCtx
      );
      expect(mockApplySkillSignals).toHaveBeenCalledWith("user-1", [
        { tag: "lumen", signal: expected },
      ]);
    });
  });

  it("does not call applySkillSignals when tagsTouched is empty", async () => {
    await submitFeedback(
      { sessionId: "s1", signal: "already_knew", tagsTouched: [] },
      authCtx
    );
    expect(mockApplySkillSignals).not.toHaveBeenCalled();
  });

  it("throws 'internal' HttpsError when feedback write fails", async () => {
    mockFeedbackSet.mockRejectedValueOnce(new Error("firestore down"));
    await expect(
      submitFeedback({ sessionId: "s1", signal: "helpful" }, authCtx)
    ).rejects.toMatchObject({ code: "internal" });
  });

  it("trims comments over 2000 chars", async () => {
    const big = "x".repeat(3000);
    await submitFeedback(
      { sessionId: "s1", signal: "helpful", comment: big },
      authCtx
    );
    const payload = mockFeedbackSet.mock.calls[0][0];
    expect(payload.comment.length).toBe(2000);
  });
});
