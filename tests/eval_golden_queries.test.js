/**
 * eval_golden_queries.test.js — Golden query evaluation for tag matching.
 *
 * Measures precision, recall, and F1 across 20 representative UE5 queries.
 * Each query has expected tag matches. The test reports per-query and overall metrics.
 *
 * Usage:
 *   node --test tests/eval_golden_queries.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeQuery } from "../path-builder/src/services/QueryNormalizer.js";

// ── Golden queries: { query, expectedTags[] } ──
// expectedTags are the tag_id values that SHOULD be matched
const GOLDEN_QUERIES = [
  {
    query: "lumen reflections flickering in my level",
    expectedTags: ["rendering.lumen", "symptom.lumen_noise"],
  },
  {
    query: "how to set up nanite meshes",
    expectedTags: ["rendering.nanite"],
  },
  {
    query: "blueprint accessed none error",
    expectedTags: ["scripting.blueprint", "blueprint.accessed_none"],
  },
  {
    query: "niagara particle system VFX tutorial",
    expectedTags: ["rendering.niagara"],
  },
  {
    query: "multiplayer replication not working dedicated server",
    expectedTags: ["multiplayer.replication"],
  },
  {
    query: "landscape terrain heightmap setup",
    expectedTags: ["environment.landscape"],
  },
  {
    query: "C++ gameplay programming UCLASS",
    expectedTags: ["scripting.cpp"],
  },
  {
    query: "behavior tree AI blackboard",
    expectedTags: ["ai.behavior_tree"],
  },
  {
    query: "MetaHuman face animation",
    expectedTags: ["character.metahuman", "animation.general"],
  },
  {
    query: "sequencer cutscene camera",
    expectedTags: ["cinematic.sequencer"],
  },
  {
    query: "packaging game for Windows cooking",
    expectedTags: ["build.packaging", "platform.windows"],
  },
  {
    query: "GPU crash D3D device lost",
    expectedTags: ["crash.d3d_device_lost", "crash.gpu"],
  },
  {
    query: "material shader PBR setup",
    expectedTags: ["rendering.material"],
  },
  {
    query: "Quest VR OpenXR setup",
    expectedTags: ["platform.quest", "platform.vr", "xr.openxr"],
  },
  {
    query: "animation blueprint state machine transitions",
    expectedTags: ["scripting.anim_blueprint", "animation.state_machine"],
  },
  {
    query: "UMG widget HUD design",
    expectedTags: ["ui.umg", "ui.hud"],
  },
  {
    query: "PCG procedural content generation foliage",
    expectedTags: ["environment.pcg", "environment.foliage"],
  },
  {
    query: "ray tracing RTX reflections shadows",
    expectedTags: ["rendering.raytracing"],
  },
  {
    query: "Lyra starter project FPS template",
    expectedTags: ["template.lyra", "genre.fps"],
  },
  {
    query: "navmesh pathfinding AI navigation",
    expectedTags: ["ai.navigation"],
  },
];

/**
 * Simulate extractTagsFromText logic using normalizeQuery + term matching.
 * Since we can't import the full TagGraphService (it uses JSON imports at build time),
 * we test the normalizer's ability to produce terms that WOULD match tag data.
 *
 * We check if the normalized query contains the tag's key terms.
 */
function simulateTagExtraction(query) {
  const { normalized } = normalizeQuery(query);
  const words = new Set(normalized.split(/\s+/));
  const matchedTagIds = new Set();

  // Map of tag_id → key terms that would trigger a match
  const TAG_TRIGGER_TERMS = {
    "rendering.lumen": ["lumen", "global illumination"],
    "rendering.nanite": ["nanite", "virtual geometry"],
    "rendering.niagara": ["niagara", "particle", "vfx", "visual effects"],
    "rendering.material": ["material", "shader", "pbr"],
    "rendering.lighting": ["lighting", "light", "lightmass"],
    "rendering.raytracing": ["ray tracing", "raytracing", "rtx", "dxr"],
    "rendering.vsm": ["vsm", "virtual shadow"],
    "scripting.blueprint": ["blueprint", "blueprints", "visual scripting"],
    "scripting.cpp": ["c++", "cpp", "uclass", "uproperty"],
    "scripting.anim_blueprint": ["animation blueprint", "anim blueprint", "abp"],
    "scripting.python": ["python"],
    "scripting.gameplay_tags": ["gameplay tag"],
    "animation.general": ["animation", "skeletal", "anim sequence"],
    "animation.control_rig": ["control rig"],
    "animation.epic_skeleton": ["epic skeleton", "mannequin"],
    "animation.state_machine": ["state machine"],
    "environment.landscape": ["landscape", "terrain", "heightmap"],
    "environment.level_design": ["level design"],
    "environment.pcg": ["pcg", "procedural content generation", "procedural generation"],
    "environment.foliage": ["foliage", "vegetation"],
    "multiplayer.replication": ["replication", "networking", "multiplayer", "dedicated server"],
    "multiplayer.rpc": ["rpc", "remote procedure call"],
    "ai.behavior_tree": ["behavior tree", "blackboard", "eqs"],
    "ai.navigation": ["navigation", "navmesh", "pathfinding"],
    "build.packaging": ["packaging", "cooking", "pak"],
    "crash.d3d_device_lost": ["d3d device lost", "d3d", "device lost"],
    "crash.access_violation": ["access violation", "null pointer", "segfault"],
    "crash.gpu": ["gpu crash", "gpu"],
    "blueprint.accessed_none": ["accessed none"],
    "blueprint.infinite_loop": ["infinite loop"],
    "ui.umg": ["umg", "widget", "unreal motion graphics"],
    "ui.hud": ["hud", "heads up display"],
    "character.metahuman": ["metahuman"],
    "cinematic.sequencer": ["sequencer", "cutscene"],
    "platform.vr": ["vr", "virtual reality"],
    "platform.quest": ["quest"],
    "platform.windows": ["windows", "win64"],
    "platform.mobile": ["mobile", "ios", "android"],
    "xr.openxr": ["openxr"],
    "tool.uat": ["uat", "automation tool"],
    "tool.ubt": ["ubt", "build tool"],
    "debug.callstack": ["callstack", "stack trace"],
    "debug.symbols": ["debug symbols", "pdb"],
    "debug.output_log": ["output log", "ue_log"],
    "genre.fps": ["fps", "first person shooter", "shooter"],
    "genre.rpg": ["rpg", "role playing"],
    "genre.survival": ["survival"],
    "genre.rts": ["rts", "strategy"],
    "style.realistic": ["realistic", "photorealistic"],
    "style.stylized": ["stylized", "toon"],
    "style.low_poly": ["low poly"],
    "specialty.archviz": ["archviz", "architectural"],
    "specialty.dmx": ["dmx", "stage lighting"],
    "physics.chaos": ["chaos", "destruction", "physics simulation"],
    "template.lyra": ["lyra"],
    "symptom.lumen_noise": ["lumen noise", "flickering", "lumen artifacts"],
  };

  for (const [tagId, triggers] of Object.entries(TAG_TRIGGER_TERMS)) {
    for (const trigger of triggers) {
      const triggerWords = trigger.split(/\s+/);

      if (triggerWords.length > 1) {
        // Phrase match
        if (normalized.includes(trigger)) {
          matchedTagIds.add(tagId);
          break;
        }
      } else {
        // Single word match
        if (words.has(trigger)) {
          matchedTagIds.add(tagId);
          break;
        }
      }
    }
  }

  return [...matchedTagIds];
}

/**
 * Compute precision, recall, F1 for a single query.
 */
function computeMetrics(predicted, expected) {
  const predSet = new Set(predicted);
  const expSet = new Set(expected);

  let tp = 0;
  for (const p of predSet) {
    if (expSet.has(p)) tp++;
  }

  const precision = predSet.size > 0 ? tp / predSet.size : 0;
  const recall = expSet.size > 0 ? tp / expSet.size : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return { precision, recall, f1, tp, fp: predSet.size - tp, fn: expSet.size - tp };
}

// ── Tests ──

describe("Golden Query Evaluation", () => {
  const results = [];

  for (const { query, expectedTags } of GOLDEN_QUERIES) {
    it(`should match: "${query}"`, () => {
      const predicted = simulateTagExtraction(query);
      const metrics = computeMetrics(predicted, expectedTags);
      results.push({ query, predicted, expected: expectedTags, ...metrics });

      // Each query should have recall >= 0.5 (at least half the expected tags found)
      assert.ok(
        metrics.recall >= 0.5,
        `Recall too low (${metrics.recall.toFixed(2)}) for: "${query}"\n` +
          `  Expected: [${expectedTags.join(", ")}]\n` +
          `  Got:      [${predicted.join(", ")}]`
      );
    });
  }

  it("should report overall F1 >= 0.75", () => {
    if (results.length === 0) return;

    let totalPrecision = 0;
    let totalRecall = 0;
    let totalF1 = 0;

    for (const r of results) {
      totalPrecision += r.precision;
      totalRecall += r.recall;
      totalF1 += r.f1;
    }

    const avgPrecision = totalPrecision / results.length;
    const avgRecall = totalRecall / results.length;
    const avgF1 = totalF1 / results.length;

    console.log("\n╔════════════════════════════════════════════╗");
    console.log("║      Golden Query Evaluation Summary       ║");
    console.log("╠════════════════════════════════════════════╣");
    console.log(
      `║  Queries:    ${results.length.toString().padStart(4)}                          ║`
    );
    console.log(`║  Precision:  ${avgPrecision.toFixed(3).padStart(6)}                        ║`);
    console.log(`║  Recall:     ${avgRecall.toFixed(3).padStart(6)}                        ║`);
    console.log(`║  F1 Score:   ${avgF1.toFixed(3).padStart(6)}                        ║`);
    console.log("╚════════════════════════════════════════════╝\n");

    // Per-query breakdown for failures
    const failures = results.filter((r) => r.f1 < 1.0);
    if (failures.length > 0) {
      console.log("Per-query issues:");
      for (const f of failures) {
        console.log(
          `  ⚠️  "${f.query}" — P:${f.precision.toFixed(2)} R:${f.recall.toFixed(2)} F1:${f.f1.toFixed(2)}`
        );
        if (f.fn > 0) {
          const missed = f.expected.filter((e) => !f.predicted.includes(e));
          console.log(`      Missed: [${missed.join(", ")}]`);
        }
        if (f.fp > 0) {
          const extra = f.predicted.filter((p) => !f.expected.includes(p));
          console.log(`      Extra:  [${extra.join(", ")}]`);
        }
      }
      console.log("");
    }

    assert.ok(avgF1 >= 0.75, `Overall F1 (${avgF1.toFixed(3)}) is below target (0.75)`);
  });
});
