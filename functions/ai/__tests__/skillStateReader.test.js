/**
 * skillStateReader.test.js — readSkillState + buildSkillStateSnippet.
 */

const mockGet = jest.fn();

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: mockGet,
      })),
    })),
  })),
}));

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  readSkillState,
  buildSkillStateSnippet,
  EMPTY_STATE,
} = require("../skillStateReader");

function docSnap(exists, data) {
  return {
    exists,
    data: () => data,
  };
}

describe("readSkillState", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("returns empty state when uid is missing", async () => {
    const state = await readSkillState();
    expect(state).toEqual({
      skillState: {},
      topicsLearned: [],
      persona: null,
      lastQueryAt: null,
      lastPathId: null,
    });
  });

  it("returns empty state when uid is not a string", async () => {
    const state = await readSkillState(42);
    expect(state.skillState).toEqual({});
  });

  it("returns empty state when doc doesn't exist", async () => {
    mockGet.mockResolvedValue(docSnap(false, null));
    const state = await readSkillState("uid-1");
    expect(state).toEqual({
      skillState: {},
      topicsLearned: [],
      persona: null,
      lastQueryAt: null,
      lastPathId: null,
    });
  });

  it("returns full state when doc exists", async () => {
    const data = {
      skillState: {
        lumen: { level: "intermediate", confidence: 0.6, encounters: 4 },
      },
      topicsLearned: ["lumen", "nanite"],
      persona: "indie_dev",
      lastQueryAt: 12345,
      lastPathId: "path-99",
    };
    mockGet.mockResolvedValue(docSnap(true, data));
    const state = await readSkillState("uid-1");
    expect(state.skillState.lumen.level).toBe("intermediate");
    expect(state.topicsLearned).toEqual(["lumen", "nanite"]);
    expect(state.persona).toBe("indie_dev");
    expect(state.lastPathId).toBe("path-99");
  });

  it("returns safe empty state when Firestore throws", async () => {
    mockGet.mockRejectedValue(new Error("firestore down"));
    const state = await readSkillState("uid-1");
    expect(state.skillState).toEqual({});
    expect(state.topicsLearned).toEqual([]);
  });

  it("exports EMPTY_STATE constant", () => {
    expect(EMPTY_STATE).toBeDefined();
    expect(EMPTY_STATE.skillState).toEqual({});
  });
});

describe("buildSkillStateSnippet", () => {
  it('returns "" on null/undefined/non-object', () => {
    expect(buildSkillStateSnippet(null)).toBe("");
    expect(buildSkillStateSnippet(undefined)).toBe("");
    expect(buildSkillStateSnippet("nope")).toBe("");
  });

  it('returns "" when state has no persona/topics/learned/path', () => {
    expect(
      buildSkillStateSnippet({
        skillState: {},
        topicsLearned: [],
        persona: null,
        lastPathId: null,
      })
    ).toBe("");
  });

  it("caps to 8 topics, ordered by encounters DESC", () => {
    const skillState = {};
    for (let i = 0; i < 12; i++) {
      skillState[`tag${i}`] = {
        level: "beginner",
        confidence: 0.1,
        encounters: i, // tag11 has most encounters
        lastSeenAt: Date.now(),
      };
    }
    const snippet = buildSkillStateSnippet({
      skillState,
      topicsLearned: [],
      persona: null,
      lastPathId: null,
    });
    expect(snippet).toContain("tag11");
    expect(snippet).toContain("tag4");
    // tag3 and below should be dropped (only top 8)
    expect(snippet).not.toContain("tag3 ");
    expect(snippet).not.toContain("tag0 ");
  });

  it("filters out stale entries (lastSeenAt > 90 days old)", () => {
    const now = Date.now();
    const old = now - 100 * 24 * 60 * 60 * 1000; // 100 days
    const snippet = buildSkillStateSnippet({
      skillState: {
        fresh: { level: "intermediate", confidence: 0.6, encounters: 3, lastSeenAt: now },
        stale: { level: "expert", confidence: 0.9, encounters: 100, lastSeenAt: old },
      },
      topicsLearned: [],
      persona: null,
      lastPathId: null,
    });
    expect(snippet).toContain("fresh");
    expect(snippet).not.toContain("stale");
  });

  it("includes persona and lastPathId when present", () => {
    const snippet = buildSkillStateSnippet({
      skillState: {
        lumen: { level: "intermediate", confidence: 0.6, encounters: 2, lastSeenAt: Date.now() },
      },
      topicsLearned: ["lumen"],
      persona: "environment_artist",
      lastPathId: "path-abc",
    });
    expect(snippet).toContain("Persona: environment_artist");
    expect(snippet).toContain("Prior path: path-abc");
    expect(snippet).toContain("lumen (intermediate)");
  });

  it("falls back to completed topics line when no current skillState", () => {
    const snippet = buildSkillStateSnippet({
      skillState: {},
      topicsLearned: ["nanite", "lumen"],
      persona: "indie",
      lastPathId: null,
    });
    expect(snippet).toContain("Completed topics: nanite, lumen");
  });

  it("includes mastery in topic line when opportunities > 0 (PFA)", () => {
    const snippet = buildSkillStateSnippet({
      skillState: {
        "blueprints.basics": {
          level: "intermediate",
          confidence: 0.6,
          encounters: 4,
          successes: 3,
          failures: 1,
          opportunities: 4,
          mastery: 0.62,
          lastSeenAt: Date.now(),
        },
      },
      topicsLearned: [],
      persona: null,
      lastPathId: null,
    });
    expect(snippet).toContain("blueprints.basics (intermediate, mastery 0.62)");
  });

  it("omits mastery when opportunities is 0 (legacy docs)", () => {
    const snippet = buildSkillStateSnippet({
      skillState: {
        lumen: {
          level: "intermediate",
          confidence: 0.6,
          encounters: 2,
          lastSeenAt: Date.now(),
        },
      },
      topicsLearned: [],
      persona: null,
      lastPathId: null,
    });
    expect(snippet).toContain("lumen (intermediate)");
    expect(snippet).not.toContain("mastery");
  });
});
