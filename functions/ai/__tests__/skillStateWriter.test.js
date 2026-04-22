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
  VALID_SIGNALS,
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
