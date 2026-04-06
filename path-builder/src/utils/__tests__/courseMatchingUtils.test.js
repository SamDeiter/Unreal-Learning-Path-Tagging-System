import { describe, it, expect } from "vitest";
import { matchCoursesToGoal, getSuggestedTags } from "../courseMatchingUtils";

describe("courseMatchingUtils", () => {
  const courses = [
    {
      code: "UE-101",
      title: "Introduction to Unreal Engine 5",
      description: "Basics of the editor and core concepts.",
      tags: { level: "Beginner", topic: "General" },
    },
    {
      code: "UE-201",
      title: "Advanced Blueprint Scripting",
      description: "Master complex logic using Blueprints.",
      extracted_tags: ["blueprints", "scripting"],
      tags: { level: "Advanced", topic: "Blueprints" },
    },
    {
      code: "UE-301",
      title: "Niagara Particle Effects",
      description: "Create stunning VFX with Niagara.",
      transcript_tags: ["niagara", "vfx", "particles"],
      tags: { level: "Intermediate", topic: "VFX" },
    },
  ];

  describe("matchCoursesToGoal", () => {
    it("returns empty array for invalid input", () => {
      expect(matchCoursesToGoal("", courses)).toEqual([]);
      expect(matchCoursesToGoal("a", courses)).toEqual([]);
      expect(matchCoursesToGoal("goal", null)).toEqual([]);
    });

    it("matches courses by title", () => {
      const results = matchCoursesToGoal("Unreal Engine Introduction", courses);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].code).toBe("UE-101");
    });

    it("matches courses by tags", () => {
      const results = matchCoursesToGoal("Blueprint logic", courses);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].code).toBe("UE-201");
    });

    it("matches courses by description", () => {
      const results = matchCoursesToGoal("stunning VFX", courses);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].code).toBe("UE-301");
    });

    it("scores multi-word matches correctly", () => {
      const results = matchCoursesToGoal("Niagara Particle Effects", courses);
      expect(results[0].code).toBe("UE-301");
      expect(results[0].matchScore).toBeGreaterThan(50);
    });
  });

  describe("getSuggestedTags", () => {
    const tags = [
      { label: "Blueprints", display_name: "Blueprints" },
      { label: "Niagara", display_name: "Niagara" },
      { label: "Lighting", display_name: "Lighting" },
    ];

    it("returns empty array for no match", () => {
      expect(getSuggestedTags("rendering", tags)).toEqual([]);
    });

    it("returns matching tags", () => {
      const results = getSuggestedTags("Master Blueprints and Niagara", tags);
      expect(results.length).toBe(2);
      expect(results.map(r => r.label)).toContain("Blueprints");
      expect(results.map(r => r.label)).toContain("Niagara");
    });
  });
});
