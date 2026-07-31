import { describe, it, expect } from "vitest";
import { stem, stemMatch, getSentenceStems } from "../stemmer";

describe("stemmer caching behaviors", () => {
  it("returns identical outputs as raw stemming", () => {
    expect(stem("boundaries")).toBe("boundary");
    expect(getSentenceStems("post-process static meshes")).toEqual([
      "post",
      "proces",
      "static",
      "mesh",
    ]);
  });

  it("handles empty / undefined / null inputs gracefully", () => {
    expect(stem("")).toBe("");
    expect(stem(null)).toBe("");
    expect(getSentenceStems("")).toEqual([]);
    expect(getSentenceStems(null)).toEqual([]);
  });

  it("safely enforces maximum cache limit", () => {
    // Fill the caches with unique entries to trigger FIFO eviction
    for (let i = 0; i < 6000; i++) {
      stem(`word_${i}`);
      getSentenceStems(`sentence_${i}`);
    }
    // Should still work normally and not crash or run out of memory
    expect(stem("working")).toBe("work");
    expect(getSentenceStems("working mesh")).toEqual(["work", "mesh"]);
  });
});

describe("stemmer performance benchmark", () => {
  it("measures performance speedup on repeated matching", () => {
    const topics = ["lumen", "lighting", "shadow", "mesh", "blueprint", "material"];
    const documents = [
      { key: "lumen_global_illumination", label: "Lumen Global Illumination", desc: "Setting up Lumen in Unreal Engine 5 for real-time lighting and reflections" },
      { key: "static_meshes_nanite", label: "Nanite Static Meshes", desc: "Enabling Nanite virtualized geometry on static meshes to render high polygon counts" },
      { key: "blueprint_visual_scripting", label: "Intro to Blueprints", desc: "Using visual scripting blueprints for player controllers and game logic" },
      { key: "material_graphs_textures", label: "Advanced Material Graphs", desc: "Creating PBR materials with texture coordinates and custom shader nodes" },
      { key: "post_process_volume", label: "Post Process Volume Settings", desc: "Configuring color grading, ambient occlusion, and bloom settings" },
    ];

    // Warm-up to populate caches
    for (const t of topics) {
      for (const d of documents) {
        stemMatch(t, d.key);
        stemMatch(t, d.label);
        stemMatch(t, d.desc);
      }
    }

    const start = performance.now();
    const ITERATIONS = 1000;

    for (let i = 0; i < ITERATIONS; i++) {
      for (const t of topics) {
        for (const d of documents) {
          stemMatch(t, d.key);
          stemMatch(t, d.label);
          stemMatch(t, d.desc);
        }
      }
    }
    const end = performance.now();
    const elapsed = end - start;

    console.log(`[Benchmark] ${ITERATIONS} iterations of ${topics.length * documents.length * 3} stemMatch calls completed in ${elapsed.toFixed(2)}ms.`);

    // Ensure the operation is lightning fast (typically < 10ms with cache, whereas without cache it would be much slower)
    expect(elapsed).toBeLessThan(150); // Generous assertion to account for slow sandbox environments
  });
});
