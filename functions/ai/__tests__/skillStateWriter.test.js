/**
 * skillStateWriter.test.js — applySkillSignal / applySkillSignals.
 *
 * Emulates Firestore transactions with an in-memory doc.
 */

// In-memory Firestore mock with transaction support
let __docData = null;
let __docExists = false;

const mockTxGet = jest.fn(async () => ({
  exists: __docExists,
  data: () => (__docExists ? __docData : undefined),
}));

const mockTxSet = jest.fn((_ref, update, opts) => {
  if (opts && opts.merge) {
    __docData = { ...(__docData || {}), ...update };
  } else {
    __docData = { ...update };
  }
  __docExists = true;
});

const mockRunTransaction = jest.fn(async (fn) => {
  return fn({ get: mockTxGet, set: mockTxSet });
});

jest.mock("firebase-admin", () => {
  const firestore = jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ __ref: true })),
    })),
    runTransaction: mockRunTransaction,
  }));
  firestore.FieldValue = {
    serverTimestamp: jest.fn(() => "SERVER_TS"),
  };
  return { firestore };
});

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  applySkillSignal,
  applySkillSignals,
  computeMastery,
  VALID_SIGNALS,
  PFA_COEFFICIENTS,
} = require("../skillStateWriter");

function resetDoc(data = null) {
  __docData = data;
  __docExists = !!data;
}

describe("applySkillSignal", () => {
  beforeEach(() => {
    mockTxGet.mockClear();
    mockTxSet.mockClear();
    mockRunTransaction.mockClear();
    resetDoc();
  });

  it("exports the expected valid signals", () => {
    expect(VALID_SIGNALS.has("encountered")).toBe(true);
    expect(VALID_SIGNALS.has("completed")).toBe(true);
    expect(VALID_SIGNALS.has("mastered")).toBe(true);
    expect(VALID_SIGNALS.has("struggled")).toBe(true);
    expect(VALID_SIGNALS.has("rejected")).toBe(true);
  });

  it("is a no-op when uid is missing", async () => {
    await applySkillSignal(undefined, { tag: "lumen", signal: "encountered" });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("is a no-op when tag is missing", async () => {
    await applySkillSignal("uid-1", { signal: "encountered" });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("is a no-op for invalid signal", async () => {
    await applySkillSignal("uid-1", { tag: "lumen", signal: "whatever" });
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("'encountered' bumps encounters + tiny confidence", async () => {
    await applySkillSignal("uid-1", { tag: "lumen", signal: "encountered" });
    expect(__docData.skillState.lumen.encounters).toBe(1);
    expect(__docData.skillState.lumen.confidence).toBeCloseTo(0.02, 5);
    expect(__docData.skillState.lumen.level).toBe("beginner");
  });

  it("'completed' bumps confidence by 0.2; beginner→intermediate when confidence > 0.5", async () => {
    resetDoc({
      skillState: { lumen: { level: "beginner", confidence: 0.4, encounters: 2 } },
    });
    await applySkillSignal("uid-1", { tag: "lumen", signal: "completed" });
    const entry = __docData.skillState.lumen;
    expect(entry.confidence).toBeCloseTo(0.6, 5);
    expect(entry.level).toBe("intermediate");
    expect(__docData.topicsLearned).toContain("lumen");
  });

  it("intermediate → expert transition when confidence > 0.85", async () => {
    resetDoc({
      skillState: { lumen: { level: "intermediate", confidence: 0.8, encounters: 5 } },
      topicsLearned: ["lumen"],
    });
    await applySkillSignal("uid-1", { tag: "lumen", signal: "completed" });
    expect(__docData.skillState.lumen.level).toBe("expert");
    expect(__docData.skillState.lumen.confidence).toBeCloseTo(1.0, 5);
  });

  it("'mastered' snaps to expert / confidence 1.0", async () => {
    await applySkillSignal("uid-1", { tag: "nanite", signal: "mastered" });
    expect(__docData.skillState.nanite.level).toBe("expert");
    expect(__docData.skillState.nanite.confidence).toBe(1.0);
    expect(__docData.topicsLearned).toContain("nanite");
  });

  it("'struggled' reduces confidence and may downgrade", async () => {
    resetDoc({
      skillState: { lumen: { level: "expert", confidence: 0.8, encounters: 10 } },
      topicsLearned: ["lumen"],
    });
    await applySkillSignal("uid-1", { tag: "lumen", signal: "struggled" });
    const entry = __docData.skillState.lumen;
    expect(entry.confidence).toBeCloseTo(0.65, 5);
    // expert downgrades to intermediate when confidence < 0.7
    expect(entry.level).toBe("intermediate");
  });

  it("'rejected' is a no-op on skillState", async () => {
    resetDoc({
      skillState: { lumen: { level: "intermediate", confidence: 0.6, encounters: 3 } },
    });
    const before = JSON.stringify(__docData);
    await applySkillSignal("uid-1", { tag: "lumen", signal: "rejected" });
    // The writer may still call the transaction but must not alter the entry.
    expect(__docData.skillState.lumen.level).toBe("intermediate");
    expect(__docData.skillState.lumen.confidence).toBe(0.6);
    expect(before).toContain('"confidence":0.6');
  });

  it("confidence clamps to [0, 1]", async () => {
    resetDoc({
      skillState: { nanite: { level: "beginner", confidence: 0.05, encounters: 1 } },
    });
    await applySkillSignal("uid-1", { tag: "nanite", signal: "struggled", weight: 0.5 });
    expect(__docData.skillState.nanite.confidence).toBe(0);

    resetDoc({
      skillState: { lumen: { level: "intermediate", confidence: 0.95, encounters: 5 } },
    });
    await applySkillSignal("uid-1", { tag: "lumen", signal: "completed", weight: 0.5 });
    expect(__docData.skillState.lumen.confidence).toBe(1);
  });

  it("creates doc if missing (first write)", async () => {
    resetDoc(null); // no doc
    await applySkillSignal("uid-1", { tag: "lumen", signal: "encountered" });
    expect(__docExists).toBe(true);
    expect(__docData.skillState.lumen).toBeDefined();
    expect(__docData.createdAt).toBe("SERVER_TS");
  });

  it("adds tag to topicsLearned when reaching intermediate+", async () => {
    resetDoc({
      skillState: { nanite: { level: "beginner", confidence: 0.4, encounters: 2 } },
      topicsLearned: [],
    });
    await applySkillSignal("uid-1", { tag: "nanite", signal: "completed" });
    expect(__docData.topicsLearned).toEqual(["nanite"]);
  });

  it("swallows errors and never throws", async () => {
    mockRunTransaction.mockRejectedValueOnce(new Error("tx failed"));
    await expect(
      applySkillSignal("uid-1", { tag: "lumen", signal: "encountered" })
    ).resolves.toBeUndefined();
  });

  // ------------------------------------------------------------------
  // PFA counter increments (Phase 2A)
  // ------------------------------------------------------------------

  it("'encountered' bumps opportunities only (no success/failure)", async () => {
    await applySkillSignal("uid-1", { tag: "lumen", signal: "encountered" });
    const e = __docData.skillState.lumen;
    expect(e.opportunities).toBe(1);
    expect(e.successes).toBe(0);
    expect(e.failures).toBe(0);
    expect(e.mastery).toBeGreaterThan(0);
    expect(e.mastery).toBeLessThan(1);
  });

  it("'completed' bumps successes + opportunities", async () => {
    await applySkillSignal("uid-1", { tag: "lumen", signal: "completed" });
    const e = __docData.skillState.lumen;
    expect(e.successes).toBe(1);
    expect(e.failures).toBe(0);
    expect(e.opportunities).toBe(1);
  });

  it("'mastered' bumps successes + opportunities", async () => {
    await applySkillSignal("uid-1", { tag: "nanite", signal: "mastered" });
    const e = __docData.skillState.nanite;
    expect(e.successes).toBe(1);
    expect(e.failures).toBe(0);
    expect(e.opportunities).toBe(1);
  });

  it("'struggled' bumps failures + opportunities", async () => {
    resetDoc({
      skillState: { lumen: { level: "intermediate", confidence: 0.5, encounters: 2 } },
    });
    await applySkillSignal("uid-1", { tag: "lumen", signal: "struggled" });
    const e = __docData.skillState.lumen;
    expect(e.failures).toBe(1);
    expect(e.successes).toBe(0);
    expect(e.opportunities).toBe(1);
  });

  it("carries forward existing PFA counters on next signal", async () => {
    resetDoc({
      skillState: {
        lumen: {
          level: "intermediate",
          confidence: 0.5,
          encounters: 3,
          successes: 2,
          failures: 1,
          opportunities: 3,
          mastery: 0.4,
        },
      },
    });
    await applySkillSignal("uid-1", { tag: "lumen", signal: "completed" });
    const e = __docData.skillState.lumen;
    expect(e.successes).toBe(3);
    expect(e.failures).toBe(1);
    expect(e.opportunities).toBe(4);
  });

  it("mastery > 0.85 promotes level to expert via PFA", async () => {
    // 10 successes, 0 failures → logit = -1 + 4 = 3 → mastery ≈ 0.95
    resetDoc({
      skillState: {
        lumen: {
          level: "beginner",
          confidence: 0.1,
          encounters: 9,
          successes: 9,
          failures: 0,
          opportunities: 9,
          mastery: 0.9,
        },
      },
    });
    await applySkillSignal("uid-1", { tag: "lumen", signal: "completed" });
    const e = __docData.skillState.lumen;
    expect(e.mastery).toBeGreaterThan(0.85);
    expect(e.level).toBe("expert");
  });
});

describe("applySkillSignals (batch)", () => {
  beforeEach(() => {
    mockTxGet.mockClear();
    mockTxSet.mockClear();
    mockRunTransaction.mockClear();
    resetDoc();
  });

  it("is a no-op when uid missing or signals empty", async () => {
    await applySkillSignals(null, [{ tag: "x", signal: "encountered" }]);
    await applySkillSignals("uid-1", []);
    await applySkillSignals("uid-1", null);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("applies multiple signals in a single transaction", async () => {
    await applySkillSignals("uid-1", [
      { tag: "lumen", signal: "completed" },
      { tag: "nanite", signal: "mastered" },
    ]);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(__docData.skillState.lumen).toBeDefined();
    expect(__docData.skillState.nanite.level).toBe("expert");
    expect(__docData.topicsLearned).toEqual(
      expect.arrayContaining(["nanite"])
    );
  });

  it("swallows errors from transaction failures", async () => {
    mockRunTransaction.mockRejectedValueOnce(new Error("batch tx failed"));
    await expect(
      applySkillSignals("uid-1", [{ tag: "lumen", signal: "encountered" }])
    ).resolves.toBeUndefined();
  });
});

describe("computeMastery (PFA)", () => {
  it("exports PFA_COEFFICIENTS with the documented defaults", () => {
    expect(PFA_COEFFICIENTS.beta0).toBe(-1.0);
    expect(PFA_COEFFICIENTS.gamma).toBe(0.4);
    expect(PFA_COEFFICIENTS.rho).toBe(-0.3);
  });

  it("at (0, 0) returns sigmoid(-1) ≈ 0.269 — starts below 0.5", () => {
    const m = computeMastery(0, 0);
    expect(m).toBeCloseTo(1 / (1 + Math.exp(1)), 5);
    expect(m).toBeLessThan(0.5);
  });

  it("lots of successes and no failures pushes mastery into expert band (>0.85)", () => {
    expect(computeMastery(10, 0)).toBeGreaterThan(0.85);
  });

  it("lots of failures crushes mastery below 0.15", () => {
    expect(computeMastery(0, 10)).toBeLessThan(0.15);
  });

  it("successes and failures partly cancel (monotonic)", () => {
    const balanced = computeMastery(5, 5);
    const withMoreSuccess = computeMastery(6, 5);
    expect(withMoreSuccess).toBeGreaterThan(balanced);
  });

  it("returns a float in [0, 1] even for extreme counters (logit clamp)", () => {
    const huge = computeMastery(10_000_000, 0);
    const squashed = computeMastery(0, 10_000_000);
    expect(huge).toBeLessThanOrEqual(1);
    expect(huge).toBeGreaterThan(0.9999);
    expect(squashed).toBeGreaterThanOrEqual(0);
    expect(squashed).toBeLessThan(0.0001);
  });

  it("treats negative or non-finite counters as zero", () => {
    expect(computeMastery(-5, -5)).toBeCloseTo(computeMastery(0, 0), 5);
    expect(computeMastery(NaN, NaN)).toBeCloseTo(computeMastery(0, 0), 5);
  });
});
