/**
 * ingestQuizResult.test.js — callable handler tests.
 */

const mockLessonGet = jest.fn();
let mockLessonExists = true;
let mockLessonData = { skillTags: ["lumen reflections", "tsr basics"] };

jest.mock("firebase-admin", () => {
  const doc = jest.fn(() => ({
    get: () => mockLessonGet(),
  }));
  const collection = jest.fn(() => ({
    doc: jest.fn(() => ({
      collection: jest.fn(() => ({ doc })),
    })),
  }));
  const firestore = jest.fn(() => ({ collection }));
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

const { ingestQuizResult } = require("../ingestQuizResult");

const authCtx = { auth: { uid: "user-1" }, app: {} };
const noAuthCtx = { auth: null, app: {} };

describe("ingestQuizResult callable", () => {
  beforeEach(() => {
    mockApplySkillSignals.mockClear();
    mockLessonGet.mockReset();
    mockLessonExists = true;
    mockLessonData = { skillTags: ["lumen reflections", "tsr basics"] };
    mockLessonGet.mockImplementation(() =>
      Promise.resolve({
        exists: mockLessonExists,
        data: () => mockLessonData,
      })
    );
  });

  it("rejects unauthenticated calls", async () => {
    await expect(
      ingestQuizResult({ lessonId: "l1", score: 2, total: 3 }, noAuthCtx)
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects missing lessonId", async () => {
    await expect(
      ingestQuizResult({ score: 2, total: 3 }, authCtx)
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects invalid score/total", async () => {
    await expect(
      ingestQuizResult({ lessonId: "l1", score: -1, total: 3 }, authCtx)
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      ingestQuizResult({ lessonId: "l1", score: 5, total: 3 }, authCtx)
    ).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(
      ingestQuizResult({ lessonId: "l1", score: 0, total: 0 }, authCtx)
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("returns not-found when lesson doc is missing (owned by a different uid, or gone)", async () => {
    mockLessonExists = false;
    await expect(
      ingestQuizResult({ lessonId: "missing", score: 2, total: 3 }, authCtx)
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("maps ratio >= 0.8 to 'mastered'", async () => {
    const out = await ingestQuizResult(
      { lessonId: "l1", score: 4, total: 5 },
      authCtx
    );
    expect(out).toEqual({ success: true, signalsApplied: 2 });
    expect(mockApplySkillSignals).toHaveBeenCalledWith("user-1", [
      { tag: "lumen reflections", signal: "mastered" },
      { tag: "tsr basics", signal: "mastered" },
    ]);
  });

  it("maps ratio <= 0.4 to 'struggled'", async () => {
    const out = await ingestQuizResult(
      { lessonId: "l1", score: 1, total: 5 },
      authCtx
    );
    expect(out).toEqual({ success: true, signalsApplied: 2 });
    expect(mockApplySkillSignals).toHaveBeenCalledWith("user-1", [
      { tag: "lumen reflections", signal: "struggled" },
      { tag: "tsr basics", signal: "struggled" },
    ]);
  });

  it("maps middle ratio to 'encountered'", async () => {
    const out = await ingestQuizResult(
      { lessonId: "l1", score: 3, total: 5 },
      authCtx
    );
    expect(out).toEqual({ success: true, signalsApplied: 2 });
    expect(mockApplySkillSignals).toHaveBeenCalledWith("user-1", [
      { tag: "lumen reflections", signal: "encountered" },
      { tag: "tsr basics", signal: "encountered" },
    ]);
  });

  it("returns 0 signals when lesson has no skillTags", async () => {
    mockLessonData = {};
    const out = await ingestQuizResult(
      { lessonId: "l1", score: 4, total: 5 },
      authCtx
    );
    expect(out).toEqual({ success: true, signalsApplied: 0 });
    expect(mockApplySkillSignals).not.toHaveBeenCalled();
  });
});
