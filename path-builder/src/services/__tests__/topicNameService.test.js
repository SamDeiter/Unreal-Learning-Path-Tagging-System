/**
 * topicNameService.test.js — Unit tests for display name generation.
 */
import { describe, it, expect } from "vitest";
import { getDisplayName } from "../topicNameService";

describe("getDisplayName", () => {
  it("returns topic + cleaned title for a course with tags.topic", () => {
    const course = {
      title: "PGT_219.00_07_Setting Up Base Materials",
      tags: { topic: "World Building" },
      canonical_tags: ["rendering.material"],
    };
    const name = getDisplayName(course);
    expect(name).toContain("World Building");
    expect(name).toContain("Setting Up Base Materials");
    expect(name).not.toContain("PGT_");
    expect(name).not.toContain("219.00");
  });

  it("falls back to canonical_tag label when tags.topic is missing", () => {
    const course = {
      title: "311.01_02_HandPaintedMaterials_5.00",
      canonical_tags: ["rendering.material"],
    };
    const name = getDisplayName(course);
    expect(name).toContain("Materials");
    expect(name).toContain("Hand Painted Materials");
  });

  it("returns cleaned title when no tags available", () => {
    const course = {
      title: "111.00_03_SculptingTheLandscape_55",
    };
    const name = getDisplayName(course);
    expect(name).toContain("Sculpting");
    expect(name).toContain("Landscape");
    expect(name).not.toContain("111.00");
    expect(name).not.toContain("_55");
  });

  it("handles intro/overview titles by returning just the topic", () => {
    const course = {
      title: "219.01_01_Intro_56",
      tags: { topic: "World Building" },
    };
    const name = getDisplayName(course);
    expect(name).toBe("World Building");
  });

  it("returns 'Untitled Step' for null input", () => {
    expect(getDisplayName(null)).toBe("Untitled Step");
    expect(getDisplayName(undefined)).toBe("Untitled Step");
  });

  it("handles segment.title for bespoke path steps", () => {
    const step = {
      segment: { title: "Understanding PCG Workflows" },
      tags: { topic: "Procedural Generation" },
    };
    const name = getDisplayName(step);
    expect(name).toContain("Procedural Generation");
    expect(name).toContain("PCG Workflows");
  });

  it("avoids redundancy when focus already contains prefix", () => {
    const course = {
      title: "Landscape Sculpting",
      tags: { topic: "Landscape" },
    };
    const name = getDisplayName(course);
    // Should not produce "Landscape - Landscape Sculpting"
    expect(name).toBe("Landscape Sculpting");
  });

  it("uses course code as absolute fallback", () => {
    const course = { code: "311.04", title: "" };
    const name = getDisplayName(course);
    expect(name).toBe("311.04");
  });

  it("truncates excessively long names to MAX_NAME_LENGTH (60 chars)", () => {
    const course = {
      title: "This Is A Very Long Title That Should Be Truncated Because It Exceeds Character Limit",
      tags: { topic: "Advanced Topics" },
    };
    const name = getDisplayName(course);
    // MAX_NAME_LENGTH is 60; smartTruncate adds "…" so result may be ≤ 61
    expect(name.length).toBeLessThanOrEqual(61);
  });
});
