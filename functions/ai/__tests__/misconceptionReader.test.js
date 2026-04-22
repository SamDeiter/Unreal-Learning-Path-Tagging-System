/**
 * misconceptionReader.test.js — snippet builder + ranking logic.
 *
 * Phase 3 — Misconception Library.
 */

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      where: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ empty: true, forEach: () => {} })),
      })),
    })),
  })),
}));

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  buildMisconceptionSnippet,
  _internal: { sanitizeTags, rankMisconceptions, dedupById },
} = require("../misconceptionReader");

describe("sanitizeTags", () => {
  test("drops non-strings and empties, dedupes, caps at 10", () => {
    const input = ["a", "a", null, undefined, 42, "b", "", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
    const result = sanitizeTags(input);
    expect(result.length).toBe(10);
    expect(result[0]).toBe("a");
    expect(new Set(result).size).toBe(result.length);
  });

  test("returns [] for non-array", () => {
    expect(sanitizeTags(null)).toEqual([]);
    expect(sanitizeTags("abc")).toEqual([]);
    expect(sanitizeTags(undefined)).toEqual([]);
  });

  test("truncates long strings to 120 chars", () => {
    const long = "x".repeat(200);
    const result = sanitizeTags([long]);
    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(120);
  });
});

describe("dedupById", () => {
  test("keeps first occurrence by id", () => {
    const input = [
      { id: "a", x: 1 },
      { id: "b", x: 2 },
      { id: "a", x: 3 },
    ];
    const out = dedupById(input);
    expect(out).toHaveLength(2);
    expect(out[0].x).toBe(1);
    expect(out[1].x).toBe(2);
  });

  test("skips entries without id", () => {
    const input = [{ id: null }, { x: 1 }, { id: "a" }];
    const out = dedupById(input);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("a");
  });
});

describe("rankMisconceptions", () => {
  test("sorts by signalCount desc, then learnerCount desc", () => {
    const input = [
      { id: "a", signalCount: 10, learnerCount: 3 },
      { id: "b", signalCount: 50, learnerCount: 2 },
      { id: "c", signalCount: 50, learnerCount: 30 },
      { id: "d", signalCount: 5, learnerCount: 50 },
    ];
    const ranked = rankMisconceptions(input).map((d) => d.id);
    expect(ranked).toEqual(["c", "b", "a", "d"]);
  });

  test("treats missing counts as 0", () => {
    const input = [
      { id: "a" },
      { id: "b", signalCount: 1 },
    ];
    const ranked = rankMisconceptions(input).map((d) => d.id);
    expect(ranked).toEqual(["b", "a"]);
  });
});

describe("buildMisconceptionSnippet", () => {
  test("returns empty string for empty/missing input", () => {
    expect(buildMisconceptionSnippet()).toBe("");
    expect(buildMisconceptionSnippet([])).toBe("");
    expect(buildMisconceptionSnippet(null)).toBe("");
  });

  test("renders a bulleted list with header", () => {
    const out = buildMisconceptionSnippet([
      { name: "Confuses Action with Axis Mapping", description: "Learners assume axis mappings fire on discrete presses." },
      { name: "Missing Input Component", description: "Thinks input works without adding an InputComponent." },
    ]);
    expect(out).toContain("Known misconceptions for this topic");
    expect(out).toContain("- Confuses Action with Axis Mapping: Learners assume");
    expect(out).toContain("- Missing Input Component: Thinks input");
  });

  test("falls back to '(unnamed)' when only description is present", () => {
    const out = buildMisconceptionSnippet([{ description: "raw desc" }]);
    expect(out).toContain("- (unnamed): raw desc");
  });

  test("skips entries missing both name and description", () => {
    const out = buildMisconceptionSnippet([
      { name: "", description: "" },
      { name: "valid", description: "d" },
    ]);
    expect(out.split("\n")).toHaveLength(2);
    expect(out).toContain("- valid: d");
  });

  test("returns empty when no valid entries", () => {
    expect(buildMisconceptionSnippet([{}, { name: "" }])).toBe("");
  });
});
