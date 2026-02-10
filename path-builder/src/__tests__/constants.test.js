import { describe, it, expect } from "vitest";
import { SEARCH_STOPWORDS } from "../domain/constants";

describe("SEARCH_STOPWORDS", () => {
  it("is a Set", () => {
    expect(SEARCH_STOPWORDS).toBeInstanceOf(Set);
  });

  it("contains common English stopwords", () => {
    const expected = ["the", "and", "for", "with", "from", "this", "that"];
    for (const word of expected) {
      expect(SEARCH_STOPWORDS.has(word)).toBe(true);
    }
  });

  it("contains UE-specific noise words", () => {
    const ueNoise = ["unreal", "engine", "introduction"];
    for (const word of ueNoise) {
      expect(SEARCH_STOPWORDS.has(word)).toBe(true);
    }
  });

  it("does NOT contain meaningful search terms", () => {
    const meaningful = ["nanite", "lumen", "blueprint", "niagara", "material"];
    for (const word of meaningful) {
      expect(SEARCH_STOPWORDS.has(word)).toBe(false);
    }
  });

  it("has a reasonable size (15-100 entries)", () => {
    expect(SEARCH_STOPWORDS.size).toBeGreaterThan(15);
    expect(SEARCH_STOPWORDS.size).toBeLessThan(200);
  });
});
