/**
 * ingestQuizResult.test.js — callable handler + buildQuizSignals helper tests.
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

const {
  ingestQuizResult,
  buildQuizSignals,
  ratioToSignal,
} = require("../ingestQuizResult");

const authCtx = { auth: { uid: "user-1" }, app: {} };
const noAuthCtx = { auth: null, app: {} };

describe("ratioToSignal", () => {
  it("maps ratio >= 0.8 to mastered", () => {
    expect(ratioToSignal(1.0)).toBe("mastered");
    expect(ratioToSignal(0.8)).toBe("mastered");
  });
  it("maps ratio <= 0.4 to struggled", () => {
    expect(ratioToSignal(0.4)).toBe("struggled");
    expect(ratioToSignal(0.0)).toBe("struggled");
  });
  it("maps middle ratios to encountered", () => {
    expect(ratioToSignal(0.5)).toBe("encountered");
    expect(ratioToSignal(0.7)).toBe("encountered");
  });
  it("returns null for non-finite", () => {
    expect(ratioToSignal(NaN)).toBeNull();
  });
});

describe("buildQuizSignals (coarse mode)", () => {
  it("returns one signal per lesson tag based on ratio", () => {
    const signals = buildQuizSignals({
      skillTags: ["lumen", "nanite"],
      score: 8,
      total: 10,
    });
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signal === "mastered")).toBe(true);
    expect(signals.map((s) => s.tag).sort()).toEqual(["lumen", "nanite"]);
  });

  it("returns [] when there are no tags or total is 0", () => {
    expect(buildQuizSignals({ score: 5, total: 10 })).toEqual([]);
    expect(buildQuizSignals({ skillTags: ["lumen"], total: 0 })).toEqual([]);
  });

  it("perfect score maps to mastered", () => {
    const signals = buildQuizSignals({
      skillTags: ["lumen"],
      score: 10,
      total: 10,
    });
    expect(signals[0]).toEqual({ tag: "lumen", signal: "mastered" });
  });

  it("zero score maps to struggled", () => {
    const signals = buildQuizSignals({
      skillTags: ["lumen"],
      score: 0,
      total: 10,
    });
    expect(signals[0]).toEqual({ tag: "lumen", signal: "struggled" });
  });
});

describe("buildQuizSignals (per-question mode)", () => {
  it("a 10-question quiz with per-question results writes 10 signals, not 1", () => {
    const perQuestionResults = [];
    for (let i = 0; i < 10; i++) {
      perQuestionResults.push({ correct: i % 2 === 0, skillTags: ["lumen"] });
    }
    const signals = buildQuizSignals({
      skillTags: ["lumen"],
      perQuestionResults,
    });
    expect(signals).toHaveLength(10);
    expect(signals.filter((s) => s.signal === "completed")).toHaveLength(5);
    expect(signals.filter((s) => s.signal === "struggled")).toHaveLength(5);
  });

  it("emits one signal per question per tag", () => {
    const signals = buildQuizSignals({
      perQuestionResults: [
        { correct: true, skillTags: ["lumen", "nanite"] },
        { correct: false, skillTags: ["lumen"] },
      ],
    });
    expect(signals).toHaveLength(3);
    expect(signals.filter((s) => s.tag === "lumen")).toHaveLength(2);
    expect(signals.filter((s) => s.tag === "nanite")).toHaveLength(1);
  });

  it("falls back to lesson-level skillTags when a question omits its own", () => {
    const signals = buildQuizSignals({
      skillTags: ["blueprints.basics"],
      perQuestionResults: [
        { correct: true },
        { correct: false },
      ],
    });
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.tag === "blueprints.basics")).toBe(true);
    expect(signals[0].signal).toBe("completed");
    expect(signals[1].signal).toBe("struggled");
  });

  it("skips questions with no usable tags", () => {
    const signals = buildQuizSignals({
      perQuestionResults: [
        { correct: true },
        { correct: false, skillTags: ["lumen"] },
      ],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toEqual({ tag: "lumen", signal: "struggled" });
  });
});

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

  it("returns not-found when lesson doc is missing", async () => {
    mockLessonExists = false;
    await expect(
      ingestQuizResult({ lessonId: "missing", score: 2, total: 3 }, authCtx)
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("maps ratio >= 0.8 to 'mastered' (coarse mode)", async () => {
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

  it("maps ratio <= 0.4 to 'struggled' (coarse mode)", async () => {
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

  it("maps middle ratio to 'encountered' (coarse mode)", async () => {
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

  it("per-question mode emits one signal per question per lesson tag", async () => {
    const out = await ingestQuizResult(
      {
        lessonId: "l1",
        score: 2,
        total: 4,
        perQuestionResults: [
          { correct: true },
          { correct: true },
          { correct: false },
          { correct: false },
        ],
      },
      authCtx
    );
    expect(out).toEqual({ success: true, signalsApplied: 8 });
    const [uid, signals] = mockApplySkillSignals.mock.calls[0];
    expect(uid).toBe("user-1");
    expect(signals).toHaveLength(8);
    expect(signals.filter((s) => s.signal === "completed")).toHaveLength(4);
    expect(signals.filter((s) => s.signal === "struggled")).toHaveLength(4);
  });
});
