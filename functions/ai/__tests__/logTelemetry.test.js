/**
 * logTelemetry.test.js — skill-signal routing + repeated-query detection.
 *
 * Exercises routeSkillSignals indirectly via the onCall handler.
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockApplySkillSignals = jest.fn(() => Promise.resolve());
const mockApplySkillSignal = jest.fn(() => Promise.resolve());

jest.mock("../skillStateWriter", () => ({
  applySkillSignals: (...args) => mockApplySkillSignals(...args),
  applySkillSignal: (...args) => mockApplySkillSignal(...args),
}));

jest.mock("../../utils/apiUsage", () => ({
  logApiUsage: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../utils/appCheckMiddleware", () => ({
  requireAppCheck: jest.fn(),
}));

// Firestore mock for repeat detection
const mockGet = jest.fn();
const mockLimit = jest.fn(() => ({ get: mockGet }));
const mockWhere3 = jest.fn(() => ({ limit: mockLimit }));
const mockWhere2 = jest.fn(() => ({ where: mockWhere3 }));
const mockWhere1 = jest.fn(() => ({ where: mockWhere2 }));
const mockCollection = jest.fn(() => ({ where: mockWhere1 }));

jest.mock("firebase-admin", () => {
  return {
    firestore: Object.assign(
      jest.fn(() => ({
        collection: mockCollection,
      })),
      {
        Timestamp: {
          fromMillis: jest.fn((ms) => ({ toMillis: () => ms })),
        },
      }
    ),
  };
});

jest.mock("firebase-functions/v2/https", () => {
  class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  return {
    onCall: (_opts, handler) => handler,
    HttpsError,
  };
});

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { logTelemetry } = require("../logTelemetry");

function fakeRequest(type, rest = {}, uid = "uid-1") {
  return {
    data: { type, ...rest },
    auth: uid ? { uid } : null,
    app: {},
  };
}

function emptyFirestoreSnap() {
  return { forEach: (fn) => {} };
}

describe("logTelemetry — skill signal routing", () => {
  beforeEach(() => {
    mockApplySkillSignals.mockClear();
    mockApplySkillSignals.mockResolvedValue(undefined);
    mockApplySkillSignal.mockClear();
    mockGet.mockReset();
    mockGet.mockResolvedValue(emptyFirestoreSnap());
  });

  it("rejects missing type", async () => {
    await expect(logTelemetry(fakeRequest(undefined))).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects unknown type", async () => {
    await expect(logTelemetry(fakeRequest("weird_event"))).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("query_submitted with tags emits 'encountered' signals", async () => {
    await logTelemetry(
      fakeRequest("query_submitted", { tags: ["lumen", "nanite"] })
    );
    // Allow fire-and-forget routing to resolve
    await Promise.resolve();
    await Promise.resolve();
    expect(mockApplySkillSignals).toHaveBeenCalled();
    const firstCall = mockApplySkillSignals.mock.calls[0];
    expect(firstCall[0]).toBe("uid-1");
    expect(firstCall[1]).toEqual([
      { tag: "lumen", signal: "encountered", weight: 0.02 },
      { tag: "nanite", signal: "encountered", weight: 0.02 },
    ]);
  });

  it("repeated tag (3+ hits in 7d) emits 'struggled'", async () => {
    mockGet.mockResolvedValue({
      forEach: (fn) => {
        // Two prior doc hits for lumen → with current submission makes 3
        fn({ data: () => ({ tags: ["lumen"] }) });
        fn({ data: () => ({ tags: ["lumen"] }) });
      },
    });
    await logTelemetry(
      fakeRequest("query_submitted", { tags: ["lumen"] })
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const signalsCalls = mockApplySkillSignals.mock.calls.map((c) => c[1]);
    // First call: encountered
    expect(signalsCalls[0]).toEqual([
      { tag: "lumen", signal: "encountered", weight: 0.02 },
    ]);
    // Second call: struggled
    expect(signalsCalls.some((args) =>
      Array.isArray(args) && args.some((s) => s.signal === "struggled" && s.tag === "lumen")
    )).toBe(true);
  });

  it("path_video_completed → 'completed' signals", async () => {
    await logTelemetry(
      fakeRequest("path_video_completed", { tags: ["lumen"] })
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(mockApplySkillSignals).toHaveBeenCalledWith("uid-1", [
      { tag: "lumen", signal: "completed" },
    ]);
  });

  it("path_viewed → 'encountered' signals (weight 0.01)", async () => {
    await logTelemetry(
      fakeRequest("path_viewed", { tags: ["nanite"] })
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(mockApplySkillSignals).toHaveBeenCalledWith("uid-1", [
      { tag: "nanite", signal: "encountered", weight: 0.01 },
    ]);
  });

  it("diagnosis_accepted → 'encountered' signals (weight 0.05)", async () => {
    await logTelemetry(
      fakeRequest("diagnosis_accepted", { tags: ["lumen"] })
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(mockApplySkillSignals).toHaveBeenCalledWith("uid-1", [
      { tag: "lumen", signal: "encountered", weight: 0.05 },
    ]);
  });

  it("skillState write failures do not break telemetry", async () => {
    mockApplySkillSignals.mockRejectedValue(new Error("boom"));
    const out = await logTelemetry(
      fakeRequest("query_submitted", { tags: ["lumen"] })
    );
    // telemetry still returns success
    expect(out).toEqual({ success: true });
  });

  it("anonymous users do not trigger skill writes", async () => {
    await logTelemetry({
      data: { type: "query_submitted", tags: ["lumen"] },
      auth: null,
      app: {},
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(mockApplySkillSignals).not.toHaveBeenCalled();
  });

  it("events with no tags do not trigger skill writes", async () => {
    await logTelemetry(fakeRequest("query_submitted", {}));
    await Promise.resolve();
    await Promise.resolve();
    expect(mockApplySkillSignals).not.toHaveBeenCalled();
  });
});
