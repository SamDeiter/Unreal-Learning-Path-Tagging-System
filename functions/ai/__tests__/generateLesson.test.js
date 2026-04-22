/**
 * generateLesson.test.js — Phase 2B/2C ZPD helpers.
 *
 * Covers computeMeanMastery, classifyDepthBand, classifyDifficultyBand, and
 * the prompt directive strings threaded into runSpoke for fade logic and
 * ZPD-aware quiz difficulty.
 */

// Defensive mocks — generateLesson.js transitively requires firebase-admin,
// firebase-functions, and various pipeline utilities. We never invoke the
// exported callable here, only the pure `_internal` helpers.
jest.mock("firebase-admin", () => {
  const collection = jest.fn(() => ({ doc: jest.fn() }));
  const firestore = jest.fn(() => ({ collection }));
  return { firestore };
});

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  config: jest.fn(() => ({})),
  runWith: jest.fn(() => ({ https: { onCall: (fn) => fn } })),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: (_opts, fn) => fn,
  HttpsError: class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "SERVER_TS"),
    vector: jest.fn((v) => ({ __vector: v })),
  },
}));

jest.mock("../../utils/rateLimit", () => ({
  checkRateLimit: jest.fn(),
  checkGlobalRateLimit: jest.fn(),
}));
jest.mock("../../utils/apiUsage", () => ({ logApiUsage: jest.fn() }));
jest.mock("../../utils/sanitizeInput", () => ({
  sanitizeAndValidate: jest.fn(),
}));
jest.mock("../../utils/appCheckMiddleware", () => ({
  requireAppCheck: jest.fn(),
}));
jest.mock("../../pipeline/llmStage", () => ({ runStage: jest.fn() }));
jest.mock("../../pipeline/telemetry", () => ({
  createTrace: jest.fn(() => ({ toLog: jest.fn() })),
}));
jest.mock("../../pipeline/cache", () => ({ normalizeQuery: jest.fn() }));
jest.mock("../../pipeline/promptVersions", () => ({
  wrapEvidence: jest.fn(),
}));
jest.mock("../skillStateReader", () => ({
  readSkillState: jest.fn(),
  buildSkillStateSnippet: jest.fn(() => ""),
}));
jest.mock("../feedbackReader", () => ({
  readLatestFeedback: jest.fn(() => Promise.resolve(null)),
  buildAffectiveDirective: jest.fn(() => ""),
}));
jest.mock("../prompts", () => ({
  UE5_GUARDRAIL: "",
  INTERACTIVE_WIDGET_HTML_PROMPT: jest.fn(() => ""),
}));

const { _internal } = require("../generateLesson");
const {
  computeMeanMastery,
  classifyDepthBand,
  classifyDifficultyBand,
  depthDirective,
  difficultyDirective,
  composeSpokePromptDirectives,
  readingLevelDirective,
  coerceReadingLevel,
} = _internal;

describe("computeMeanMastery", () => {
  it("returns {mean: null, sampled: 0} when skillState is missing/empty", () => {
    expect(computeMeanMastery(null, ["a"])).toEqual({ mean: null, sampled: 0 });
    expect(computeMeanMastery(undefined, ["a"])).toEqual({ mean: null, sampled: 0 });
    expect(computeMeanMastery({}, ["a"])).toEqual({ mean: null, sampled: 0 });
  });

  it("returns {mean: null, sampled: 0} when tags array is empty or invalid", () => {
    const state = { lumen: { mastery: 0.8, opportunities: 2 } };
    expect(computeMeanMastery(state, [])).toEqual({ mean: null, sampled: 0 });
    expect(computeMeanMastery(state, null)).toEqual({ mean: null, sampled: 0 });
  });

  it("ignores tags with opportunities === 0 (no data is not low mastery)", () => {
    const state = {
      lumen: { mastery: 0.9, opportunities: 5 },
      nanite: { mastery: 0, opportunities: 0 }, // skipped
    };
    expect(computeMeanMastery(state, ["lumen", "nanite"])).toEqual({
      mean: 0.9,
      sampled: 1,
    });
  });

  it("ignores tags not present in skillState", () => {
    const state = { lumen: { mastery: 0.7, opportunities: 3 } };
    expect(computeMeanMastery(state, ["lumen", "ghost"])).toEqual({
      mean: 0.7,
      sampled: 1,
    });
  });

  it("averages mastery across multiple qualifying tags", () => {
    const state = {
      a: { mastery: 0.4, opportunities: 2 },
      b: { mastery: 0.8, opportunities: 3 },
    };
    const { mean, sampled } = computeMeanMastery(state, ["a", "b"]);
    expect(sampled).toBe(2);
    expect(mean).toBeCloseTo(0.6, 5);
  });

  it("treats NaN/missing mastery on qualifying tags as 0", () => {
    const state = {
      a: { mastery: "nope", opportunities: 2 },
      b: { opportunities: 3 }, // no mastery field
    };
    const { mean, sampled } = computeMeanMastery(state, ["a", "b"]);
    expect(sampled).toBe(2);
    expect(mean).toBe(0);
  });

  it("skips non-string or empty tags", () => {
    const state = { lumen: { mastery: 0.9, opportunities: 2 } };
    expect(computeMeanMastery(state, ["lumen", "", 42, null])).toEqual({
      mean: 0.9,
      sampled: 1,
    });
  });
});

describe("classifyDepthBand", () => {
  it("returns 'typical' for null / undefined / NaN (no data)", () => {
    expect(classifyDepthBand(null)).toBe("typical");
    expect(classifyDepthBand(undefined)).toBe("typical");
    expect(classifyDepthBand(NaN)).toBe("typical");
  });

  it("mean >= 0.75 → 'known'", () => {
    expect(classifyDepthBand(0.75)).toBe("known");
    expect(classifyDepthBand(0.9)).toBe("known");
    expect(classifyDepthBand(1.0)).toBe("known");
  });

  it("0.3 <= mean < 0.75 → 'typical'", () => {
    expect(classifyDepthBand(0.3)).toBe("typical");
    expect(classifyDepthBand(0.5)).toBe("typical");
    expect(classifyDepthBand(0.7499)).toBe("typical");
  });

  it("mean < 0.3 → 'struggling'", () => {
    expect(classifyDepthBand(0.29)).toBe("struggling");
    expect(classifyDepthBand(0.0)).toBe("struggling");
  });
});

describe("classifyDifficultyBand", () => {
  it("returns 'medium' for null / undefined / NaN (no data)", () => {
    expect(classifyDifficultyBand(null)).toBe("medium");
    expect(classifyDifficultyBand(undefined)).toBe("medium");
    expect(classifyDifficultyBand(NaN)).toBe("medium");
  });

  it("mean >= 0.75 → 'hard'", () => {
    expect(classifyDifficultyBand(0.75)).toBe("hard");
    expect(classifyDifficultyBand(0.9)).toBe("hard");
  });

  it("0.3 <= mean < 0.75 → 'medium'", () => {
    expect(classifyDifficultyBand(0.3)).toBe("medium");
    expect(classifyDifficultyBand(0.5)).toBe("medium");
  });

  it("mean < 0.3 → 'easy'", () => {
    expect(classifyDifficultyBand(0.29)).toBe("easy");
    expect(classifyDifficultyBand(0.0)).toBe("easy");
  });
});

describe("depthDirective", () => {
  it("returns empty string for 'typical' band", () => {
    expect(depthDirective("typical", 0.5)).toBe("");
    expect(depthDirective("typical", null)).toBe("");
  });

  it("emits a known-band directive mentioning mastery and fade keywords", () => {
    const s = depthDirective("known", 0.82);
    expect(s).toContain("FADE DIRECTIVE");
    expect(s).toContain("mastery");
    expect(s).toContain("0.82");
    expect(s).toMatch(/concise|edge cases/i);
  });

  it("emits a struggling-band directive mentioning prereq primer", () => {
    const s = depthDirective("struggling", 0.21);
    expect(s).toContain("FADE DIRECTIVE");
    expect(s).toContain("0.21");
    expect(s).toMatch(/primer|simpler|misconceptions/i);
  });

  it("omits mastery value when mean is non-finite", () => {
    const s = depthDirective("known", null);
    expect(s).toContain("FADE DIRECTIVE");
    expect(s).not.toContain("mean mastery");
  });
});

describe("difficultyDirective", () => {
  it("returns empty string for 'medium' band", () => {
    expect(difficultyDirective("medium")).toBe("");
  });

  it("emits a hard-band directive", () => {
    const s = difficultyDirective("hard");
    expect(s).toContain("DIFFICULTY DIRECTIVE");
    expect(s).toContain("HARD");
    expect(s).toMatch(/edge cases|multi-step|distractors/i);
  });

  it("emits an easy-band directive", () => {
    const s = difficultyDirective("easy");
    expect(s).toContain("DIFFICULTY DIRECTIVE");
    expect(s).toContain("EASY");
    expect(s).toMatch(/recall|core understanding/i);
  });
});

describe("integration: band classification → prompt directive", () => {
  it("new-learner no-data path → typical depth, medium difficulty, no directives", () => {
    const { mean } = computeMeanMastery({}, ["a", "b"]);
    expect(mean).toBeNull();
    expect(classifyDepthBand(mean)).toBe("typical");
    expect(classifyDifficultyBand(mean)).toBe("medium");
    expect(depthDirective(classifyDepthBand(mean), mean)).toBe("");
    expect(difficultyDirective(classifyDifficultyBand(mean))).toBe("");
  });

  it("mastered learner → known depth, hard difficulty, both directives populated", () => {
    const state = {
      a: { mastery: 0.9, opportunities: 5 },
      b: { mastery: 0.8, opportunities: 4 },
    };
    const { mean } = computeMeanMastery(state, ["a", "b"]);
    expect(classifyDepthBand(mean)).toBe("known");
    expect(classifyDifficultyBand(mean)).toBe("hard");
    expect(depthDirective("known", mean)).toMatch(/FADE DIRECTIVE/);
    expect(difficultyDirective("hard")).toMatch(/DIFFICULTY DIRECTIVE/);
  });

  it("struggling learner → struggling depth, easy difficulty, both directives populated", () => {
    const state = {
      a: { mastery: 0.15, opportunities: 3 },
      b: { mastery: 0.1, opportunities: 2 },
    };
    const { mean } = computeMeanMastery(state, ["a", "b"]);
    expect(classifyDepthBand(mean)).toBe("struggling");
    expect(classifyDifficultyBand(mean)).toBe("easy");
    expect(depthDirective("struggling", mean)).toMatch(/FADE DIRECTIVE/);
    expect(difficultyDirective("easy")).toMatch(/DIFFICULTY DIRECTIVE/);
  });
});

// ── Phase 3 — affective directive flowing through spoke prompt ──────
describe("composeSpokePromptDirectives (Phase 3 — affective loop)", () => {
  it("returns '' when all directives are absent", () => {
    expect(composeSpokePromptDirectives({})).toBe("");
    expect(composeSpokePromptDirectives({ depth: "", difficulty: "", affective: "" })).toBe("");
  });

  it("renders depth + difficulty when present and no affective", () => {
    const s = composeSpokePromptDirectives({
      depth: "FADE DIRECTIVE: known.",
      difficulty: "DIFFICULTY DIRECTIVE: HARD",
      affective: "",
    });
    expect(s).toContain("FADE DIRECTIVE");
    expect(s).toContain("DIFFICULTY DIRECTIVE");
    expect(s).not.toContain("AFFECTIVE SIGNAL");
  });

  it("renders affective directive AFTER depth/difficulty so it overrides", () => {
    const s = composeSpokePromptDirectives({
      depth: "FADE_KNOWN",
      difficulty: "DIFF_HARD",
      affective: "The learner marked the previous response as CONFUSING.",
    });
    const iDepth = s.indexOf("FADE_KNOWN");
    const iDiff = s.indexOf("DIFF_HARD");
    const iAff = s.indexOf("AFFECTIVE SIGNAL");
    expect(iDepth).toBeGreaterThan(-1);
    expect(iDiff).toBeGreaterThan(iDepth);
    expect(iAff).toBeGreaterThan(iDiff);
    expect(s).toContain("CONFUSING");
    expect(s).toContain("overrides depth/difficulty defaults");
  });

  it("renders only affective block when depth/difficulty are neutral bands", () => {
    const s = composeSpokePromptDirectives({
      depth: "",
      difficulty: "",
      affective:
        "The learner marked the previous response as NOT HELPFUL. For this response: try a fundamentally different angle",
    });
    expect(s).toContain("AFFECTIVE SIGNAL");
    expect(s).toContain("NOT HELPFUL");
    expect(s).not.toContain("FADE DIRECTIVE");
    expect(s).not.toContain("DIFFICULTY DIRECTIVE");
  });
});

// ── Phase 3 — UDL reading level directive ───────────────────────────
describe("readingLevelDirective (Phase 3 — UDL slider)", () => {
  it("returns '' for 'standard' (no directive, keeps default tutor voice)", () => {
    expect(readingLevelDirective("standard")).toBe("");
  });

  it("emits a 'simple' directive mentioning middle-school reading level", () => {
    const s = readingLevelDirective("simple");
    expect(s).toContain("READING LEVEL DIRECTIVE");
    expect(s).toContain("middle-school reading level");
    expect(s).toMatch(/analog/i);
  });

  it("emits an 'advanced' directive mentioning graduate reading level", () => {
    const s = readingLevelDirective("advanced");
    expect(s).toContain("READING LEVEL DIRECTIVE");
    expect(s).toContain("graduate reading level");
    expect(s).toMatch(/terminology|precise/i);
  });

  it("returns '' silently for unknown values (no directive, no error)", () => {
    expect(readingLevelDirective("phd-plus")).toBe("");
    expect(readingLevelDirective(undefined)).toBe("");
    expect(readingLevelDirective(null)).toBe("");
    expect(readingLevelDirective(42)).toBe("");
    expect(readingLevelDirective("")).toBe("");
  });
});

describe("coerceReadingLevel (Phase 3 — server-side validation)", () => {
  it("passes through valid values unchanged", () => {
    expect(coerceReadingLevel("simple")).toBe("simple");
    expect(coerceReadingLevel("standard")).toBe("standard");
    expect(coerceReadingLevel("advanced")).toBe("advanced");
  });

  it("coerces unknown strings to 'standard' (no error)", () => {
    expect(coerceReadingLevel("phd-plus")).toBe("standard");
    expect(coerceReadingLevel("Simple")).toBe("standard"); // case-sensitive
    expect(coerceReadingLevel("")).toBe("standard");
  });

  it("coerces non-string inputs to 'standard' (defensive)", () => {
    expect(coerceReadingLevel(undefined)).toBe("standard");
    expect(coerceReadingLevel(null)).toBe("standard");
    expect(coerceReadingLevel(42)).toBe("standard");
    expect(coerceReadingLevel({})).toBe("standard");
  });
});

describe("composeSpokePromptDirectives + readingLevel (Phase 3 — UDL threading)", () => {
  it("includes a 'simple' reading-level directive with middle-school reading level", () => {
    const s = composeSpokePromptDirectives({
      depth: "",
      difficulty: "",
      readingLevel: readingLevelDirective("simple"),
      affective: "",
    });
    expect(s).toContain("middle-school reading level");
  });

  it("includes an 'advanced' reading-level directive with graduate reading level", () => {
    const s = composeSpokePromptDirectives({
      depth: "",
      difficulty: "",
      readingLevel: readingLevelDirective("advanced"),
      affective: "",
    });
    expect(s).toContain("graduate reading level");
  });

  it("emits no directive when readingLevel is unknown (falls back silently)", () => {
    const s = composeSpokePromptDirectives({
      depth: "",
      difficulty: "",
      readingLevel: readingLevelDirective("garbage"),
      affective: "",
    });
    expect(s).toBe("");
    expect(s).not.toContain("READING LEVEL DIRECTIVE");
  });

  it("renders reading-level alongside depth/difficulty without overriding affective order", () => {
    const s = composeSpokePromptDirectives({
      depth: "FADE_KNOWN",
      difficulty: "DIFF_HARD",
      readingLevel: readingLevelDirective("simple"),
      affective: "The learner marked the previous response as CONFUSING.",
    });
    const iDepth = s.indexOf("FADE_KNOWN");
    const iDiff = s.indexOf("DIFF_HARD");
    const iRead = s.indexOf("middle-school reading level");
    const iAff = s.indexOf("AFFECTIVE SIGNAL");
    expect(iDepth).toBeGreaterThan(-1);
    expect(iDiff).toBeGreaterThan(iDepth);
    expect(iRead).toBeGreaterThan(iDiff);
    // Affective still renders LAST so it overrides depth/difficulty defaults
    expect(iAff).toBeGreaterThan(iRead);
  });
});
