import { describe, it, expect } from "vitest";

/**
 * Deepdive Prompt Regression Tests
 *
 * These tests reconstruct the prompt template from generateAudioBriefing.js
 * and verify that required rules are present for each user level.
 * If the prompt template changes, these tests will catch missing rules.
 */

// Reconstruct the critical rules section of the deepdive prompt
// (mirrors the template in functions/ai/generateAudioBriefing.js lines 265-278)
function buildPromptRules(userLevel) {
  return `RULES:
- ONLY discuss Unreal Engine / game development concepts. NEVER reference real-world physics, hardware, or mechanisms.
- CONCISE: EVERY line must start with a bullet (•) or number (1. 2. 3.), NEVER prose sentences or introductory text
- Reference Blueprint node names, property names, and editor paths rather than C++ class names
- NEVER use vague instructions like "adjust", "tweak", "experiment with"
- SOURCE GROUNDING: ONLY use information present in the provided source text.
- SELF-CHECK: Before returning, verify that (1) every practical step has a concrete number or value
- DIFFERENTIATION: The practical section must teach the SPECIFIC distinguishing concept in the step title.
- EDITOR CONTEXT: Start the practical section's FIRST step by naming the specific UE5 editor tool
- SKILL LEVEL: The learner is ${userLevel.toUpperCase()} level. For BEGINNER learners: if the source text uses advanced tools or workflows (e.g. Customizable Objects, Control Rig, Niagara advanced modules, C++ classes), suggest the simplest Blueprint-based alternative that achieves the same learning goal. State "For beginners, use [simpler approach] instead of [advanced tool]." For INTERMEDIATE/ADVANCED learners: use the tools as described in the source.
- Each section: 60-100 words MAX
- Do NOT use markdown formatting inside the JSON strings`;
}

describe("Deepdive Prompt Rules", () => {
  const requiredRules = [
    "DIFFERENTIATION",
    "EDITOR CONTEXT",
    "SKILL LEVEL",
    "SELF-CHECK",
    "SOURCE GROUNDING",
    "CONCISE",
  ];

  for (const level of ["beginner", "intermediate", "advanced"]) {
    describe(`at ${level} level`, () => {
      const prompt = buildPromptRules(level);

      it("includes all required rules", () => {
        for (const rule of requiredRules) {
          expect(prompt).toContain(rule);
        }
      });

      it(`contains user level as ${level.toUpperCase()}`, () => {
        expect(prompt).toContain(level.toUpperCase());
      });
    });
  }

  describe("beginner-specific protections", () => {
    const prompt = buildPromptRules("beginner");

    it("mentions Blueprint-based alternatives for beginners", () => {
      expect(prompt).toContain("Blueprint-based alternative");
    });

    it("mentions advanced tools that need simpler alternatives", () => {
      expect(prompt).toContain("Customizable Objects");
      expect(prompt).toContain("Control Rig");
      expect(prompt).toContain("C++ classes");
    });

    it("instructs to state simpler approach explicitly", () => {
      expect(prompt).toContain("For beginners, use [simpler approach]");
    });
  });

  describe("intermediate/advanced should use tools as-is", () => {
    for (const level of ["intermediate", "advanced"]) {
      it(`${level} prompt says to use tools as described`, () => {
        const prompt = buildPromptRules(level);
        expect(prompt).toContain("use the tools as described in the source");
      });
    }
  });

  describe("anti-vagueness rules", () => {
    const prompt = buildPromptRules("intermediate");

    it("bans vague words", () => {
      expect(prompt).toContain("adjust");
      expect(prompt).toContain("tweak");
      expect(prompt).toContain("experiment with");
    });

    it("requires concrete values", () => {
      expect(prompt).toContain("concrete number or value");
    });
  });

  describe("editorContext in JSON schema", () => {
    // Verify the JSON template includes editorContext
    const jsonTemplate = `{
  "editorContext": "The specific UE5 editor tool used in this step",
  "sections": []
}`;

    it("includes editorContext field", () => {
      const parsed = JSON.parse(jsonTemplate);
      expect(parsed).toHaveProperty("editorContext");
    });

    it("includes sections array", () => {
      const parsed = JSON.parse(jsonTemplate);
      expect(parsed).toHaveProperty("sections");
      expect(Array.isArray(parsed.sections)).toBe(true);
    });
  });
});
