/**
 * mineMisconceptions.test.js — pure helper coverage.
 *
 * Phase 3 — Misconception Library synthesis pipeline.
 */

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({ get: jest.fn() })),
      })),
      doc: jest.fn(() => ({ get: jest.fn(), set: jest.fn() })),
    })),
  })),
}));

jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  config: jest.fn(() => ({})),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_opts, fn) => fn),
  HttpsError: class extends Error {
    constructor(code, msg) {
      super(msg);
      this.code = code;
    }
  },
}));

jest.mock("../../utils/appCheckMiddleware", () => ({
  requireAppCheck: jest.fn(),
}));

const {
  _internal: { shortHash, slugify, groupSignalsByTag, parseGeminiJson, collectRelatedTags, sanitizeTags },
} = require("../mineMisconceptions");

describe("shortHash", () => {
  test("stable for identical input", () => {
    expect(shortHash("abc")).toBe(shortHash("abc"));
  });
  test("differs across inputs", () => {
    expect(shortHash("abc")).not.toBe(shortHash("xyz"));
  });
});

describe("slugify", () => {
  test("normalizes to lowercase underscores", () => {
    expect(slugify("Action Mapping")).toBe("action_mapping");
    expect(slugify("UE5: Input-System!")).toBe("ue5_input_system");
  });
  test("caps length at 40", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBe(40);
  });
  test("empty/invalid returns empty", () => {
    expect(slugify("")).toBe("");
    expect(slugify(null)).toBe("");
    expect(slugify(undefined)).toBe("");
  });
});

describe("sanitizeTags", () => {
  test("dedupes and caps at 20", () => {
    const arr = Array.from({ length: 30 }, (_, i) => `t${i}`);
    expect(sanitizeTags(arr)).toHaveLength(20);
  });
  test("rejects non-strings", () => {
    expect(sanitizeTags([1, null, "ok", {}])).toEqual(["ok"]);
  });
});

describe("groupSignalsByTag", () => {
  test("groups a signal into each of its tags", () => {
    const signals = [
      { id: "s1", skillTags: ["a", "b"] },
      { id: "s2", skillTags: ["a"] },
      { id: "s3", skillTags: ["b", "c"] },
    ];
    const g = groupSignalsByTag(signals);
    expect(g.get("a")).toHaveLength(2);
    expect(g.get("b")).toHaveLength(2);
    expect(g.get("c")).toHaveLength(1);
  });
  test("skips tagless signals", () => {
    const g = groupSignalsByTag([{ id: "s1" }, { id: "s2", skillTags: [] }]);
    expect(g.size).toBe(0);
  });
});

describe("parseGeminiJson", () => {
  test("parses clean JSON", () => {
    expect(parseGeminiJson('{"misconceptions":[]}')).toEqual({ misconceptions: [] });
  });
  test("strips ```json fences", () => {
    const input = '```json\n{"misconceptions":[{"name":"M"}]}\n```';
    expect(parseGeminiJson(input)).toEqual({ misconceptions: [{ name: "M" }] });
  });
  test("extracts first JSON object from noisy text", () => {
    const input = 'Here is the result: {"misconceptions":[]} — enjoy.';
    expect(parseGeminiJson(input)).toEqual({ misconceptions: [] });
  });
  test("returns null for unparseable input", () => {
    expect(parseGeminiJson("nope")).toBeNull();
    expect(parseGeminiJson("")).toBeNull();
    expect(parseGeminiJson(null)).toBeNull();
  });
});

describe("collectRelatedTags", () => {
  test("ranks co-occurring tags by frequency, excludes primary, caps at 5", () => {
    const signals = [
      { skillTags: ["main", "x", "y"] },
      { skillTags: ["main", "x", "z"] },
      { skillTags: ["main", "x"] },
      { skillTags: ["main", "y"] },
      { skillTags: ["main", "a", "b", "c", "d", "e", "f"] },
    ];
    const related = collectRelatedTags(signals, "main");
    expect(related[0]).toBe("x"); // appeared 3 times
    expect(related).not.toContain("main");
    expect(related.length).toBeLessThanOrEqual(5);
  });
});
