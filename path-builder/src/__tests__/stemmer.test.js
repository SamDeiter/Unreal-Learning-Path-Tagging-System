import { describe, it, expect } from "vitest";
import { stem, stemWord, stemMatch } from "../utils/stemmer";

describe("stem", () => {
  it("strips -ies to -y", () => {
    expect(stem("boundaries")).toBe("boundary");
    expect(stem("properties")).toBe("property");
  });

  it("strips -ves to -f", () => {
    expect(stem("wolves")).toBe("wolf");
  });

  it("strips -ing suffix", () => {
    expect(stem("importing")).toBe("import");
    expect(stem("getting")).toBe("gett");
    expect(stem("working")).toBe("work");
  });

  it("strips -ed suffix", () => {
    expect(stem("imported")).toBe("import");
    expect(stem("worked")).toBe("work");
  });

  it("strips -s suffix", () => {
    expect(stem("meshes")).toBe("mesh");
    expect(stem("materials")).toBe("material");
  });

  it("strips -tion suffix", () => {
    expect(stem("animation")).toBe("anima");
  });

  it("strips -ment suffix", () => {
    expect(stem("environment")).toBe("environ");
  });

  it("lowercases the result", () => {
    expect(stem("Blueprint")).toBe("blueprint");
    expect(stem("MESHES")).toBe("mesh");
  });

  it("handles short words", () => {
    expect(stem("UE5")).toBe("ue5");
    expect(stem("a")).toBe("a");
  });
});

describe("stemWord (alias)", () => {
  it("is the same function as stem", () => {
    expect(stemWord).toBe(stem);
  });
});

describe("stemMatch", () => {
  it("matches identical stems", () => {
    expect(stemMatch("mesh", "meshes")).toBe(true);
    expect(stemMatch("importing", "import")).toBe(true);
  });

  it("matches substring stems", () => {
    expect(stemMatch("light", "lighting")).toBe(true);
  });

  it("splits on spaces, underscores, and hyphens", () => {
    expect(stemMatch("static mesh", "static_meshes")).toBe(true);
    expect(stemMatch("post-process", "post processing")).toBe(true);
  });

  it("filters words shorter than 3 characters", () => {
    // "a" and "an" are filtered out — only "mesh" matters
    expect(stemMatch("a mesh", "meshes")).toBe(true);
  });

  it("returns false for unrelated words", () => {
    expect(stemMatch("blueprint", "material")).toBe(false);
    expect(stemMatch("lumen", "nanite")).toBe(false);
  });
});
