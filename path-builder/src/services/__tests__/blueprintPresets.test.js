/**
 * blueprintPresets.test.js — Unit tests for Blueprint preset URL matching.
 */

import { describe, it, expect } from "vitest";
import {
  getBlueprintUrl,
  BLUEPRINT_EDITOR_BASE,
  BLUEPRINT_PRESETS,
} from "../../data/blueprintPresets";

describe("getBlueprintUrl", () => {
  it("returns URL when step title matches a concept", () => {
    const step = {
      segment: { title: "How to Set Up a Blueprint Actor", text: "" },
      summary: "",
    };
    const url = getBlueprintUrl(step);
    expect(url).toContain(BLUEPRINT_EDITOR_BASE);
    expect(url).toContain("graph=blueprint_actor");
  });

  it("returns URL when step summary matches a concept", () => {
    const step = {
      segment: { title: "Step 2", text: "" },
      summary: "Configure collision settings for your mesh",
    };
    const url = getBlueprintUrl(step);
    expect(url).toContain("graph=collision_setup");
  });

  it("returns URL when segment text matches a concept", () => {
    const step = {
      segment: { title: "Untitled", text: "Learn about the player controller and how it works" },
      summary: "",
    };
    const url = getBlueprintUrl(step);
    expect(url).toContain("graph=player_controller_possess");
  });

  it("returns null when no concept matches", () => {
    const step = {
      segment: { title: "Compile Settings", text: "How to set compile flags" },
      summary: "Configure your build",
    };
    const url = getBlueprintUrl(step);
    expect(url).toBeNull();
  });

  it("returns null for null/undefined step", () => {
    expect(getBlueprintUrl(null)).toBeNull();
    expect(getBlueprintUrl(undefined)).toBeNull();
    expect(getBlueprintUrl({})).toBeNull();
  });

  it("prefers longer phrase matches over short ones", () => {
    const step = {
      segment: { title: "Animation Blueprint State Machine", text: "" },
      summary: "",
    };
    const url = getBlueprintUrl(step);
    // "animation blueprint" (20 chars) should match before "blueprint" inside "blueprint actor" (15 chars)
    expect(url).toContain("graph=anim_blueprint");
  });

  it("all preset values are valid URL components", () => {
    for (const [key, value] of Object.entries(BLUEPRINT_PRESETS)) {
      expect(typeof key).toBe("string");
      expect(typeof value).toBe("string");
      expect(value).toMatch(/^[a-z0-9_]+$/);
    }
  });
});
