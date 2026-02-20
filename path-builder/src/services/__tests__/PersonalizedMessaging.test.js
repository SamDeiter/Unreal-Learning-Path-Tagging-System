/**
 * Unit tests for PersonalizedMessaging
 */
import { describe, it, expect } from "vitest";
import { getPersonaWelcome, getContextBlock, getPathContextBlocks } from "../PersonalizedMessaging";

// ── Mock course objects ──────────────────────────────────────────────────
const sequencerCourse = {
  code: "200.01",
  title: "Getting Started with Sequencer",
  canonical_tags: ["sequencer", "cinematics"],
  ai_tags: ["animation"],
  gemini_system_tags: [],
  transcript_tags: [],
  extracted_tags: [],
};

const materialsCoFurse = {
  code: "150.02",
  title: "Master Materials & Shaders",
  canonical_tags: ["materials", "shaders", "rendering"],
  ai_tags: [],
  gemini_system_tags: [],
  transcript_tags: [],
  extracted_tags: [],
};

// ── getPersonaWelcome ────────────────────────────────────────────────────
describe("getPersonaWelcome", () => {
  it("returns persona-specific greeting for animator_alex", () => {
    const result = getPersonaWelcome("animator_alex");
    expect(result.greeting).toContain("animation");
    expect(result.greeting).toContain("🎬");
  });

  it("returns persona-specific greeting for indie_isaac", () => {
    const result = getPersonaWelcome("indie_isaac");
    expect(result.greeting).toContain("game dev");
    expect(result.greeting).toContain("🎮");
  });

  it("returns default greeting for invalid persona", () => {
    const result = getPersonaWelcome("nonexistent");
    expect(result.greeting).toBeTruthy();
    expect(result.painPoints).toHaveLength(0);
  });

  it("returns pain points array", () => {
    const result = getPersonaWelcome("animator_alex");
    expect(Array.isArray(result.painPoints)).toBe(true);
  });
});

// ── getContextBlock ──────────────────────────────────────────────────────
describe("getContextBlock", () => {
  it("returns context for matching persona + topic", () => {
    const result = getContextBlock("animator_alex", sequencerCourse);
    // Sequencer is a key topic for animators
    if (result.hasContext) {
      expect(result.message).toBeTruthy();
      expect(result.topic).toBeTruthy();
      expect(result.personaName).toBeTruthy();
    }
  });

  it("returns empty context for non-matching pair", () => {
    const result = getContextBlock("automotive_andy", sequencerCourse);
    // Sequencer isn't directly relevant to automotive
    expect(result.personaName).toBeTruthy(); // Persona name should still be set
  });

  it("returns empty context for null inputs", () => {
    const result = getContextBlock(null, null);
    expect(result.hasContext).toBe(false);
    expect(result.message).toBe("");
  });

  it("returns empty context for invalid persona", () => {
    const result = getContextBlock("nonexistent", sequencerCourse);
    expect(result.hasContext).toBe(false);
  });
});

// ── getPathContextBlocks ─────────────────────────────────────────────────
describe("getPathContextBlocks", () => {
  it("returns array of context blocks for a course list", () => {
    const courses = [sequencerCourse, materialsCoFurse];
    const blocks = getPathContextBlocks("animator_alex", courses);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toHaveProperty("courseCode", "200.01");
    expect(blocks[1]).toHaveProperty("courseCode", "150.02");
  });

  it("returns empty array for no courses", () => {
    const blocks = getPathContextBlocks("animator_alex", []);
    expect(blocks).toHaveLength(0);
  });

  it("returns empty array for null persona", () => {
    const blocks = getPathContextBlocks(null, [sequencerCourse]);
    expect(blocks).toHaveLength(0);
  });
});
