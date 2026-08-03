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

describe("stemMatch performance micro-benchmark", () => {
  it("should correctly match stems and demonstrate extremely fast cache-hit lookup speeds", () => {
    // Warm up the caches
    const query = "post-process volume setting";
    const targets = [
      "post processing volume settings in Unreal Engine",
      "global illumination lumen configuration",
      "nanite meshes and geometry optimization guidelines",
      "blueprint actor communication using interfaces",
      "static mesh materials import and setup"
    ];

    // Verify first that correctness is absolutely preserved
    expect(stemMatch(query, targets[0])).toBe(true);
    for (let i = 1; i < targets.length; i++) {
      expect(stemMatch(query, targets[i])).toBe(false);
    }
    for (const target of targets) {
      expect(stemMatch("nonexistent", target)).toBe(false);
    }

    // Now, run a heavy repeated matching loop to benchmark
    const iterations = 5000;
    const startTime = performance.now();
    for (let i = 0; i < iterations; i++) {
      for (const target of targets) {
        stemMatch(query, target);
        stemMatch("nonexistent", target);
      }
    }
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`[Benchmark] ${iterations * targets.length * 2} stemMatch lookups completed in ${duration.toFixed(1)}ms`);

    expect(duration).toBeLessThan(1000); // Guarantees execution doesn't hang or take too long, typically < 20ms
  });
});
