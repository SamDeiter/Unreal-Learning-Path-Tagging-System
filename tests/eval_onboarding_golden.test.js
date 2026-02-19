/**
 * eval_onboarding_golden.test.js — Golden evaluation for onboarding persona scoring.
 *
 * Validates that the local course-scoring logic in Personas.jsx correctly
 * ranks courses per persona. Each persona gets a set of expected top-category
 * courses and penalized categories that must NOT appear in top results.
 *
 * This tests the deterministic local fallback scoring, NOT the RAG pipeline.
 *
 * Usage:
 *   node --test tests/eval_onboarding_golden.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ── Persona Scoring Rules (copied from PersonaService.js — kept in sync) ──
const personaScoringRules = {
  indie_isaac: {
    boostKeywords: [
      "blueprint", "gameplay", "prototype", "interaction", "UI", "UMG",
      "save game", "inventory", "input", "level design", "your first",
      "getting started", "project", "widget", "player controller",
    ],
    penaltyKeywords: [
      "deep C++", "networking", "multiplayer", "dedicated server",
      "mass production", "automotive", "archviz",
    ],
    requiredTopics: ["viewport", "blueprint", "lighting", "packaging"],
  },
  logic_liam: {
    boostKeywords: [
      "C++", "architecture", "systems", "framework", "subsystem",
      "profiling", "optimization", "GAS", "gameplay ability",
      "replication", "networking", "debugging", "performance",
      "memory", "API", "programming",
    ],
    penaltyKeywords: [
      "marketing", "brand", "product viz", "archviz",
      "automotive", "configurator",
    ],
    requiredTopics: ["blueprint", "C++", "profiling"],
  },
  animator_alex: {
    boostKeywords: [
      "animation", "sequencer", "cinematic", "character", "mocap",
      "keyframe", "motion", "camera", "performance", "acting",
      "lighting", "storytelling", "retarget",
    ],
    penaltyKeywords: [
      "networking", "multiplayer", "dedicated server", "automotive",
      "archviz", "digital twin", "manufacturing",
    ],
    requiredTopics: ["animation", "sequencer", "lighting"],
  },
  rigger_regina: {
    boostKeywords: [
      "control rig", "IK", "FK", "constraint", "deformation",
      "skinning", "retarget", "skeleton", "bone", "joint",
      "weight", "character", "rig", "animation",
    ],
    penaltyKeywords: [
      "networking", "multiplayer", "automotive", "archviz",
      "marketing", "brand", "digital twin",
    ],
    requiredTopics: ["animation", "control rig", "character"],
  },
  designer_cpg: {
    boostKeywords: [
      "lighting", "materials", "lookdev", "product viz", "motion design",
      "camera", "presentation", "rendering", "photorealistic",
      "studio", "environment", "scene", "visualization",
    ],
    penaltyKeywords: [
      "deep C++", "networking", "multiplayer", "dedicated server",
      "GAS", "gameplay ability", "digital twin",
    ],
    requiredTopics: ["lighting", "materials", "camera"],
  },
  architect_amy: {
    boostKeywords: [
      "archviz", "architectural", "interior", "building", "walkthrough",
      "visualization", "real estate", "photorealistic", "twinmotion",
    ],
    penaltyKeywords: ["multiplayer", "gameplay", "automotive", "manufacturing"],
    requiredTopics: ["lighting", "materials"],
  },
  simulation_sam: {
    boostKeywords: [
      "simulation", "digital twin", "training", "enterprise", "industrial",
      "defense", "manufacturing", "factory",
    ],
    penaltyKeywords: ["archviz", "automotive", "gameplay", "indie"],
    requiredTopics: ["blueprint", "simulation"],
  },
  vfx_victor: {
    boostKeywords: [
      "vfx", "effects", "compositing", "particles", "niagara",
      "explosion", "destruction", "smoke", "fire", "post-process",
    ],
    penaltyKeywords: ["archviz", "automotive", "manufacturing", "digital twin"],
    requiredTopics: ["niagara", "effects"],
  },
  automotive_andy: {
    boostKeywords: [
      "automotive", "vehicle", "car", "configurator", "showroom",
      "paint", "headlight", "wheel", "dashboard", "lighting studio",
    ],
    penaltyKeywords: ["archviz", "gameplay", "digital twin", "multiplayer"],
    requiredTopics: ["materials", "lighting"],
  },
};

// ── Mock Courses: 12 courses spanning different skill areas ──────────────
// Each has: title, tags (topic, industry, level), ai_tags, canonical_tags, videos
const MOCK_COURSES = [
  {
    id: "c_blueprint",
    title: "Your First Blueprint Game - Getting Started with UE5",
    tags: { topic: "blueprint", industry: "games", level: "beginner" },
    ai_tags: ["blueprint", "getting started", "gameplay", "project", "interaction"],
    canonical_tags: ["scripting.blueprint"],
    videos: [{ drive_id: "abc" }],
    category: "Blueprint",
  },
  {
    id: "c_animation",
    title: "Character Animation Fundamentals in Sequencer",
    tags: { topic: "animation", industry: "animation", level: "beginner" },
    ai_tags: ["animation", "sequencer", "character", "keyframe", "motion"],
    canonical_tags: ["animation.general", "cinematic.sequencer"],
    videos: [{ drive_id: "abc" }],
    category: "Animation",
  },
  {
    id: "c_materials",
    title: "PBR Materials and Shader Development",
    tags: { topic: "materials", industry: "general", level: "intermediate" },
    ai_tags: ["materials", "shader", "pbr", "rendering", "lookdev"],
    canonical_tags: ["rendering.material"],
    videos: [{ drive_id: "abc" }],
    category: "Materials",
  },
  {
    id: "c_lighting",
    title: "Lighting a Photorealistic Scene with Lumen",
    tags: { topic: "lighting", industry: "general", level: "beginner" },
    ai_tags: ["lighting", "lumen", "photorealistic", "camera", "scene"],
    canonical_tags: ["rendering.lighting", "rendering.lumen"],
    videos: [{ drive_id: "abc" }],
    category: "Lighting",
  },
  {
    id: "c_controlrig",
    title: "Control Rig: IK/FK Constraints and Skeleton Retargeting",
    tags: { topic: "rigging", industry: "animation", level: "intermediate" },
    ai_tags: ["control rig", "IK", "FK", "constraint", "skeleton", "retarget", "character", "rig"],
    canonical_tags: ["animation.control_rig"],
    videos: [{ drive_id: "abc" }],
    category: "ControlRig",
  },
  {
    id: "c_automotive",
    title: "Automotive Visualization: Car Configurator Setup",
    tags: { topic: "automotive", industry: "automotive", level: "intermediate" },
    ai_tags: ["automotive", "vehicle", "car", "configurator", "paint", "lighting studio"],
    canonical_tags: [],
    videos: [{ drive_id: "abc" }],
    category: "Automotive",
  },
  {
    id: "c_archviz",
    title: "Architectural Visualization: Interior Walkthrough with Twinmotion",
    tags: { topic: "archviz", industry: "architecture", level: "beginner" },
    ai_tags: ["archviz", "architectural", "interior", "walkthrough", "twinmotion", "visualization"],
    canonical_tags: ["specialty.archviz"],
    videos: [{ drive_id: "abc" }],
    category: "ArchViz",
  },
  {
    id: "c_niagara",
    title: "Niagara VFX: Explosions, Fire, and Particle Systems",
    tags: { topic: "vfx", industry: "general", level: "intermediate" },
    ai_tags: ["niagara", "vfx", "particles", "effects", "explosion", "fire", "destruction"],
    canonical_tags: ["rendering.niagara"],
    videos: [{ drive_id: "abc" }],
    category: "Niagara/VFX",
  },
  {
    id: "c_cpp",
    title: "C++ Gameplay Programming: UCLASS, Framework Architecture",
    tags: { topic: "programming", industry: "games", level: "advanced" },
    ai_tags: ["C++", "programming", "architecture", "framework", "systems", "subsystem", "API"],
    canonical_tags: ["scripting.cpp"],
    videos: [{ drive_id: "abc" }],
    category: "C++",
  },
  {
    id: "c_networking",
    title: "Multiplayer Replication and Dedicated Server Setup",
    tags: { topic: "networking", industry: "games", level: "advanced" },
    ai_tags: ["networking", "multiplayer", "replication", "dedicated server"],
    canonical_tags: ["multiplayer.replication"],
    videos: [{ drive_id: "abc" }],
    category: "Networking",
  },
  {
    id: "c_digitaltwin",
    title: "Digital Twin: Industrial Simulation and Enterprise Training",
    tags: { topic: "simulation", industry: "simulation", level: "intermediate" },
    ai_tags: ["simulation", "digital twin", "enterprise", "training", "industrial", "manufacturing"],
    canonical_tags: [],
    videos: [{ drive_id: "abc" }],
    category: "DigitalTwin",
  },
  {
    id: "c_productviz",
    title: "Product Visualization: Lighting Studio and Presentation",
    tags: { topic: "visualization", industry: "visualization", level: "beginner" },
    ai_tags: ["product viz", "visualization", "lighting", "studio", "presentation", "materials"],
    canonical_tags: [],
    videos: [{ drive_id: "abc" }],
    category: "ProductViz",
  },
];

// ── Scoring Function (extracted from Personas.jsx.generatePath) ─────────
// Pure function — no React, no Firebase, no side effects.
function scoreCourses(personaId, rules) {
  const personaIndustryMap = {
    indie_isaac: "games",
    logic_liam: "games",
    animator_alex: "animation",
    rigger_regina: "animation",
    designer_cpg: "visualization",
    architect_amy: "architecture",
    simulation_sam: "simulation",
    vfx_victor: "vfx",
    automotive_andy: "automotive",
  };
  const personaIndustry = personaIndustryMap[personaId] || "general";

  return MOCK_COURSES.map((course) => {
    let score = 0;
    const rawTags = [
      ...(Array.isArray(course.ai_tags) ? course.ai_tags : []),
      ...(Array.isArray(course.canonical_tags) ? course.canonical_tags : []),
    ];
    if (course.tags?.topic) rawTags.push(course.tags.topic);
    if (course.tags?.industry) rawTags.push(course.tags.industry);
    const courseTags = rawTags.map((t) => (typeof t === "string" ? t.toLowerCase() : ""));
    const courseTitle = (course.title || "").toLowerCase();
    const combinedText = `${courseTitle} ${courseTags.join(" ")}`;

    // Boost keywords (+5 title, +3 tag)
    for (const keyword of rules.boostKeywords) {
      const kw = keyword.toLowerCase();
      if (courseTitle.includes(kw)) score += 5;
      if (courseTags.some((tag) => tag.includes(kw))) score += 3;
    }

    // Penalty keywords (-10 per match)
    for (const keyword of rules.penaltyKeywords) {
      const kw = keyword.toLowerCase();
      if (combinedText.includes(kw)) score -= 10;
    }

    // Industry scoring
    const courseIndustry = (course.tags?.industry || "general").toLowerCase();
    if (courseIndustry !== "general" && courseIndustry !== personaIndustry) {
      score -= 200;
    }
    if (courseIndustry === personaIndustry && courseIndustry !== "general") {
      score += 15;
    }

    return { ...course, score };
  }).sort((a, b) => b.score - a.score);
}

// ── Golden Test Cases ───────────────────────────────────────────────────
// Each persona: expected categories in top 3, forbidden categories in top 3
const GOLDEN_CASES = [
  {
    personaId: "indie_isaac",
    label: "Indie Isaac (Game Dev Beginner)",
    expectedTopCategories: ["Blueprint"],
    forbiddenTopCategories: ["Automotive", "ArchViz", "Networking"],
  },
  {
    personaId: "logic_liam",
    label: "Logic Liam (Programmer)",
    expectedTopCategories: ["C++"],
    forbiddenTopCategories: ["Automotive", "ArchViz", "ProductViz"],
  },
  {
    personaId: "animator_alex",
    label: "Animator Alex (Film/Animation)",
    expectedTopCategories: ["Animation"],
    forbiddenTopCategories: ["Automotive", "Networking", "DigitalTwin"],
  },
  {
    personaId: "rigger_regina",
    label: "Rigger Regina (Character TD)",
    expectedTopCategories: ["ControlRig"],
    forbiddenTopCategories: ["Automotive", "Networking", "DigitalTwin"],
  },
  {
    personaId: "designer_cpg",
    label: "Designer (Retail/CPG)",
    expectedTopCategories: ["ProductViz", "Lighting", "Materials"],
    forbiddenTopCategories: ["Networking", "DigitalTwin"],
  },
  {
    personaId: "architect_amy",
    label: "Architect Amy (Archviz)",
    expectedTopCategories: ["ArchViz"],
    forbiddenTopCategories: ["Automotive", "Networking", "DigitalTwin"],
  },
  {
    personaId: "simulation_sam",
    label: "Simulation Sam (Enterprise)",
    expectedTopCategories: ["DigitalTwin"],
    forbiddenTopCategories: ["Automotive", "ArchViz"],
  },
  {
    personaId: "vfx_victor",
    label: "VFX Victor (Effects Artist)",
    expectedTopCategories: ["Niagara/VFX"],
    forbiddenTopCategories: ["Automotive", "ArchViz", "DigitalTwin"],
  },
  {
    personaId: "automotive_andy",
    label: "Automotive Andy",
    expectedTopCategories: ["Automotive"],
    forbiddenTopCategories: ["ArchViz", "Networking", "DigitalTwin"],
  },
];

// ── Tests ────────────────────────────────────────────────────────────────

describe("Onboarding Persona Scoring — Golden Eval", () => {
  const allResults = [];

  for (const tc of GOLDEN_CASES) {
    describe(tc.label, () => {
      const rules = personaScoringRules[tc.personaId];
      const ranked = scoreCourses(tc.personaId, rules);
      const top3 = ranked.slice(0, 3);
      const top3Categories = top3.map((c) => c.category);

      it("should rank expected categories in top 3", () => {
        for (const expected of tc.expectedTopCategories) {
          assert.ok(
            top3Categories.includes(expected),
            `Expected "${expected}" in top 3 for ${tc.label}, ` +
              `but got: [${top3Categories.join(", ")}]\n` +
              `  Full ranking: ${ranked.map((c) => `${c.category}(${c.score})`).join(", ")}`
          );
        }
        allResults.push({
          persona: tc.personaId,
          pass: true,
          top3: top3Categories,
          expectedHits: tc.expectedTopCategories.length,
        });
      });

      it("should NOT rank forbidden categories in top 3", () => {
        for (const forbidden of tc.forbiddenTopCategories) {
          assert.ok(
            !top3Categories.includes(forbidden),
            `Forbidden "${forbidden}" found in top 3 for ${tc.label}: ` +
              `[${top3Categories.join(", ")}]\n` +
              `  Full ranking: ${ranked.map((c) => `${c.category}(${c.score})`).join(", ")}`
          );
        }
      });

      it("should cover at least 1 required topic in top 5", () => {
        const top5Text = ranked
          .slice(0, 5)
          .map((c) => `${c.title} ${c.ai_tags.join(" ")}`.toLowerCase())
          .join(" ");

        const coveredTopics = rules.requiredTopics.filter((topic) =>
          top5Text.includes(topic.toLowerCase())
        );

        assert.ok(
          coveredTopics.length >= 1,
          `No required topics covered in top 5 for ${tc.label}.\n` +
            `  Required: [${rules.requiredTopics.join(", ")}]\n` +
            `  Top 5: ${ranked.slice(0, 5).map((c) => c.category).join(", ")}`
        );
      });
    });
  }

  it("should report overall persona relevance summary", () => {
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║     Onboarding Persona Scoring — Golden Eval    ║");
    console.log("╠══════════════════════════════════════════════════╣");

    let totalPass = 0;
    for (const tc of GOLDEN_CASES) {
      const rules = personaScoringRules[tc.personaId];
      const ranked = scoreCourses(tc.personaId, rules);
      const top3 = ranked.slice(0, 3).map((c) => c.category);

      const expectedHit = tc.expectedTopCategories.every((e) => top3.includes(e));
      const noForbidden = tc.forbiddenTopCategories.every((f) => !top3.includes(f));
      const pass = expectedHit && noForbidden;
      if (pass) totalPass++;

      const status = pass ? "✅" : "❌";
      const personaLabel = tc.label.padEnd(32);
      console.log(`║  ${status} ${personaLabel} [${top3.join(", ")}]`);
    }

    const pct = Math.round((totalPass / GOLDEN_CASES.length) * 100);
    console.log("╠══════════════════════════════════════════════════╣");
    console.log(
      `║  Overall: ${totalPass}/${GOLDEN_CASES.length} personas correct (${pct}%)${"".padEnd(
        Math.max(0, 18 - `${pct}%`.length)
      )}║`
    );
    console.log("╚══════════════════════════════════════════════════╝\n");

    assert.ok(pct >= 80, `Overall persona relevance ${pct}% is below target 80%`);
  });
});
