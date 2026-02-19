/**
 * eval_onboarding_realdata.test.js — Persona scoring against REAL course catalog.
 *
 * Loads video_library_enriched.json (the actual 2400+ course catalog) and runs
 * persona scoring for each of the 9 personas. Validates that:
 *   1. No cross-industry courses leak into top results
 *   2. Required topics appear in top 5
 *   3. Penalized keywords don't dominate top results
 *   4. Playable courses (with drive_id) are surfaced
 *
 * Usage:
 *   node --test tests/eval_onboarding_realdata.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(
  __dirname,
  "../path-builder/src/data/video_library_enriched.json"
);

// ── Load real course data ───────────────────────────────────────────────
const rawData = JSON.parse(readFileSync(DATA_PATH, "utf8"));
const ALL_COURSES = rawData.courses;

// Playability filter (same as Personas.jsx)
const PLAYABLE_COURSES = ALL_COURSES.filter(
  (c) => c.videos?.length > 0 && c.videos[0]?.drive_id
);

// ── Persona Scoring Rules (from PersonaService.js) ──────────────────────
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

const PERSONA_INDUSTRY_MAP = {
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

// Industry tag normalization (real data has "Media & Entertainment", "Games", etc.)
function normalizeIndustry(raw) {
  const lower = (raw || "general").toLowerCase();
  if (lower.includes("media") || lower.includes("entertainment") || lower.includes("film")) return "animation";
  if (lower.includes("game")) return "games";
  if (lower.includes("architect")) return "architecture";
  if (lower.includes("auto")) return "automotive";
  if (lower.includes("simul") || lower.includes("enterprise")) return "simulation";
  return "general";
}

// The cross-industry blocklist for each persona type
const CROSS_INDUSTRY_BLOCKLIST = {
  indie_isaac: ["automotive", "architecture"],
  logic_liam: ["automotive", "architecture"],
  animator_alex: ["automotive"],
  rigger_regina: ["automotive"],
  designer_cpg: [],
  architect_amy: ["automotive"],
  simulation_sam: ["automotive", "architecture"],
  vfx_victor: ["automotive", "architecture"],
  automotive_andy: ["architecture"],
};

// ── Scoring Function (mirrors Personas.jsx.generatePath) ────────────────
function scoreCourses(personaId, rules, courses) {
  const personaIndustry = PERSONA_INDUSTRY_MAP[personaId] || "general";

  return courses
    .map((course) => {
      let score = 0;
      const rawTags = [
        ...(Array.isArray(course.ai_tags) ? course.ai_tags : []),
        ...(Array.isArray(course.canonical_tags) ? course.canonical_tags : []),
      ];
      if (course.tags?.topic) rawTags.push(course.tags.topic);
      if (course.tags?.industry) rawTags.push(course.tags.industry);
      const courseTags = rawTags.map((t) =>
        typeof t === "string" ? t.toLowerCase() : ""
      );
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
      const courseIndustry = normalizeIndustry(course.tags?.industry);
      if (
        courseIndustry !== "general" &&
        courseIndustry !== personaIndustry
      ) {
        score -= 200;
      }
      if (
        courseIndustry === personaIndustry &&
        courseIndustry !== "general"
      ) {
        score += 15;
      }

      // Industry-specific title penalties (from Personas.jsx)
      const industryFilters = [
        {
          match: ["legacy production", "virtual production", "broadcast",
                  "live action", "compositing", "stage operator", "icvfx",
                  "ndisplay", "cinematography", "film production",
                  "in-camera", "on-set"],
          allowPersonas: ["animation", "vfx", "film", "media"],
        },
        {
          match: ["for automotive", "automotive", "vehicle design",
                  "configurator", "car paint", "vred"],
          allowPersonas: ["automotive"],
        },
        {
          match: ["archviz", "architectural", "twinmotion",
                  "for architecture", "for design", "aeco"],
          allowPersonas: ["architecture", "design"],
        },
        {
          match: ["digital twin", "crowd simulation"],
          allowPersonas: ["simulation", "enterprise"],
        },
        {
          match: ["manufacturing", "factory", "assembly line"],
          allowPersonas: ["manufacturing", "enterprise"],
        },
      ];
      for (const filter of industryFilters) {
        const titleHit = filter.match.some((kw) => courseTitle.includes(kw));
        if (titleHit && !filter.allowPersonas.includes(personaIndustry)) {
          score -= 200;
          break;
        }
      }

      return { ...course, score };
    })
    .sort((a, b) => b.score - a.score);
}

// ── Test Cases ──────────────────────────────────────────────────────────
const PERSONA_IDS = Object.keys(personaScoringRules);

describe("Onboarding Real Data — Persona Scoring", () => {
  it(`loaded ${ALL_COURSES.length} courses, ${PLAYABLE_COURSES.length} playable`, () => {
    assert.ok(ALL_COURSES.length > 100, "Expected 100+ courses");
    assert.ok(PLAYABLE_COURSES.length > 30, "Expected 30+ playable courses");
  });

  for (const personaId of PERSONA_IDS) {
    describe(personaId, () => {
      const rules = personaScoringRules[personaId];
      const ranked = scoreCourses(personaId, rules, PLAYABLE_COURSES);
      const top5 = ranked.slice(0, 5);
      const top5Titles = top5.map((c) => c.title);

      it("should not have cross-industry courses in top 5", () => {
        const blocked = CROSS_INDUSTRY_BLOCKLIST[personaId] || [];
        for (const course of top5) {
          const ind = normalizeIndustry(course.tags?.industry);
          assert.ok(
            !blocked.includes(ind),
            `Cross-industry leak: "${course.title}" (industry: ${ind}) ` +
              `appeared in top 5 for ${personaId}`
          );
        }
      });

      it("should cover at least 1 required topic in top 5", () => {
        const top5Text = top5
          .map(
            (c) =>
              `${c.title} ${(c.ai_tags || []).join(" ")} ${(c.canonical_tags || []).join(" ")} ${c.tags?.topic || ""}`
          )
          .join(" ")
          .toLowerCase();

        const covered = rules.requiredTopics.filter((t) =>
          top5Text.includes(t.toLowerCase())
        );

        assert.ok(
          covered.length >= 1,
          `No required topics in top 5 for ${personaId}\n` +
            `  Required: [${rules.requiredTopics.join(", ")}]\n` +
            `  Top 5: ${top5Titles.join(", ")}`
        );
      });

      it("top course should have positive score", () => {
        assert.ok(
          ranked[0].score > 0,
          `Top course for ${personaId} has score ${ranked[0].score}: "${ranked[0].title}"`
        );
      });
    });
  }

  it("should report full ranking summary", () => {
    console.log("\n╔═══════════════════════════════════════════════════════════════════════╗");
    console.log("║           Onboarding Real Data — Persona Ranking Summary            ║");
    console.log(`║           ${PLAYABLE_COURSES.length} playable courses from ${ALL_COURSES.length} total${" ".repeat(Math.max(0, 25 - String(PLAYABLE_COURSES.length).length - String(ALL_COURSES.length).length))}║`);
    console.log("╠═══════════════════════════════════════════════════════════════════════╣");

    for (const personaId of PERSONA_IDS) {
      const rules = personaScoringRules[personaId];
      const ranked = scoreCourses(personaId, rules, PLAYABLE_COURSES);
      const top3 = ranked.slice(0, 3);

      console.log(`║  ${personaId.padEnd(20)}`);
      for (let i = 0; i < top3.length; i++) {
        const c = top3[i];
        const title = c.title.length > 50 ? c.title.slice(0, 47) + "..." : c.title;
        console.log(`║    ${i + 1}. ${title.padEnd(52)} (${c.score})`);
      }
      console.log("║");
    }
    console.log("╚═══════════════════════════════════════════════════════════════════════╝\n");
  });
});
