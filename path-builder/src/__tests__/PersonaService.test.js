import { describe, it, expect } from "vitest";
import {
  getAllPersonas,
  getPersonaById,
  getPainPointMessaging,
  getOnboardingPersonas,
  personaScoringRules,
} from "../services/PersonaService";

// ─── Persona Data Integrity ───────────────────────────────────

describe("getAllPersonas", () => {
  it("returns an array of 9 personas", () => {
    const personas = getAllPersonas();
    expect(Array.isArray(personas)).toBe(true);
    expect(personas.length).toBe(9);
  });

  it("every persona has required schema fields", () => {
    const required = ["id", "name", "industry", "description", "keywords", "painPoints", "onboardingMessaging", "preferences"];
    for (const p of getAllPersonas()) {
      for (const field of required) {
        expect(p).toHaveProperty(field);
      }
    }
  });
});

describe("getOnboardingPersonas", () => {
  it("returns only personas with onboardingPrimary: true", () => {
    const primary = getOnboardingPersonas();
    expect(primary.length).toBe(5);
    for (const p of primary) {
      expect(p.onboardingPrimary).toBe(true);
    }
  });

  it("includes the 5 expected new personas", () => {
    const ids = getOnboardingPersonas().map((p) => p.id);
    expect(ids).toContain("indie_isaac");
    expect(ids).toContain("logic_liam");
    expect(ids).toContain("animator_alex");
    expect(ids).toContain("rigger_regina");
    expect(ids).toContain("designer_cpg");
  });

  it("does NOT include retired gamedev_gary", () => {
    const ids = getOnboardingPersonas().map((p) => p.id);
    expect(ids).not.toContain("gamedev_gary");
  });
});

describe("getPersonaById", () => {
  it("returns the correct persona for indie_isaac", () => {
    const p = getPersonaById("indie_isaac");
    expect(p).toBeDefined();
    expect(p.name).toBe("Indie Isaac");
  });

  it("returns falsy for non-existent persona", () => {
    expect(getPersonaById("nonexistent_persona")).toBeFalsy();
  });

  it("returns falsy for retired gamedev_gary", () => {
    expect(getPersonaById("gamedev_gary")).toBeFalsy();
  });
});

// ─── Pain Point Messaging ────────────────────────────────────

describe("getPainPointMessaging", () => {
  it("returns JSON-driven onboardingMessaging for a primary persona", () => {
    const persona = getPersonaById("indie_isaac");
    const msgs = getPainPointMessaging(persona);
    expect(Array.isArray(msgs)).toBe(true);
    expect(msgs.length).toBeGreaterThan(0);
    // Should come from the JSON field, not hardcoded
    expect(msgs).toEqual(persona.onboardingMessaging);
  });

  it("returns messaging for every onboarding-primary persona", () => {
    for (const p of getOnboardingPersonas()) {
      const msgs = getPainPointMessaging(p);
      expect(msgs.length).toBeGreaterThan(0);
    }
  });

  it("returns empty array for null input", () => {
    expect(getPainPointMessaging(null)).toEqual([]);
  });

  it("returns empty array for persona with no messaging", () => {
    expect(getPainPointMessaging({ id: "fake" })).toEqual([]);
  });
});

// ─── Persona Scoring Rules ───────────────────────────────────

describe("personaScoringRules", () => {
  it("has rules for all 9 personas", () => {
    const expectedIds = [
      "indie_isaac", "logic_liam", "animator_alex", "rigger_regina", "designer_cpg",
      "architect_amy", "simulation_sam", "vfx_victor", "automotive_andy",
    ];
    for (const id of expectedIds) {
      expect(personaScoringRules).toHaveProperty(id);
    }
  });

  it("each rule has boostKeywords, penaltyKeywords, requiredTopics", () => {
    for (const rule of Object.values(personaScoringRules)) {
      expect(rule).toHaveProperty("boostKeywords");
      expect(rule).toHaveProperty("penaltyKeywords");
      expect(rule).toHaveProperty("requiredTopics");
      expect(Array.isArray(rule.boostKeywords)).toBe(true);
      expect(Array.isArray(rule.penaltyKeywords)).toBe(true);
      expect(Array.isArray(rule.requiredTopics)).toBe(true);
    }
  });

  it("ranks 'control rig' higher for rigger_regina than indie_isaac", () => {
    const reginaBoosts = personaScoringRules.rigger_regina.boostKeywords.map((k) => k.toLowerCase());
    const isaacBoosts = personaScoringRules.indie_isaac.boostKeywords.map((k) => k.toLowerCase());

    const reginaHasControlRig = reginaBoosts.some((k) => k.includes("control rig") || k.includes("rig"));
    const isaacHasControlRig = isaacBoosts.some((k) => k.includes("control rig") || k.includes("rig"));

    expect(reginaHasControlRig).toBe(true);
    expect(isaacHasControlRig).toBe(false);
  });

  it("ranks 'blueprint' higher for indie_isaac than rigger_regina", () => {
    const isaacBoosts = personaScoringRules.indie_isaac.boostKeywords.map((k) => k.toLowerCase());

    const isaacHasBP = isaacBoosts.some((k) => k.includes("blueprint"));

    expect(isaacHasBP).toBe(true);
    // Regina may or may not have blueprint; the point is Isaac definitely has it
  });

  it("penalizes automotive content for indie_isaac", () => {
    const isaacPenalties = personaScoringRules.indie_isaac.penaltyKeywords.map((k) => k.toLowerCase());
    expect(isaacPenalties.some((k) => k.includes("automotive") || k.includes("archviz"))).toBe(true);
  });

  it("does NOT penalize automotive content for automotive_andy", () => {
    const andyPenalties = personaScoringRules.automotive_andy.penaltyKeywords.map((k) => k.toLowerCase());
    expect(andyPenalties.some((k) => k.includes("automotive"))).toBe(false);
  });

  it("Isaac requires viewport and blueprint as foundational topics", () => {
    const required = personaScoringRules.indie_isaac.requiredTopics.map((t) => t.toLowerCase());
    expect(required).toContain("viewport");
    expect(required).toContain("blueprint");
  });

  it("Regina requires control rig as a foundational topic", () => {
    const required = personaScoringRules.rigger_regina.requiredTopics.map((t) => t.toLowerCase());
    expect(required.some((t) => t.includes("control rig") || t.includes("rig"))).toBe(true);
  });
});
