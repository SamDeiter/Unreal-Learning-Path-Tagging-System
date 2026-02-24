/**
 * Unit tests for PersonaService
 */
import { describe, it, expect } from "vitest";
import {
  detectPersona,
  getAllPersonas,
  getOnboardingPersonas,
  getPersonaById,
  getPainPointMessaging,
  personaScoringRules,
} from "../PersonaService";

// ── getAllPersonas ────────────────────────────────────────────────────────
describe("getAllPersonas", () => {
  it("returns a non-empty array", () => {
    const personas = getAllPersonas();
    expect(Array.isArray(personas)).toBe(true);
    expect(personas.length).toBeGreaterThan(0);
  });

  it("each persona has required fields", () => {
    for (const p of getAllPersonas()) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("keywords");
      expect(Array.isArray(p.keywords)).toBe(true);
    }
  });
});

// ── getOnboardingPersonas ────────────────────────────────────────────────
describe("getOnboardingPersonas", () => {
  it("returns only personas with onboardingPrimary flag", () => {
    const onboarding = getOnboardingPersonas();
    expect(onboarding.length).toBeGreaterThan(0);
    expect(onboarding.length).toBeLessThanOrEqual(getAllPersonas().length);
    for (const p of onboarding) {
      expect(p.onboardingPrimary).toBe(true);
    }
  });
});

// ── getPersonaById ───────────────────────────────────────────────────────
describe("getPersonaById", () => {
  it("returns a persona for a valid ID", () => {
    const all = getAllPersonas();
    const first = all[0];
    const found = getPersonaById(first.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(first.id);
  });

  it("returns null for an invalid ID", () => {
    expect(getPersonaById("nonexistent_nora")).toBeNull();
  });
});

// ── detectPersona ────────────────────────────────────────────────────────
describe("detectPersona", () => {
  it("detects game-dev persona for blueprint and gameplay keywords", () => {
    const result = detectPersona("I want to prototype gameplay with blueprints", []);
    expect(result).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.matchScore).toBeGreaterThanOrEqual(3);
  });

  it("detects persona from tags alone", () => {
    const result = detectPersona("", ["animation", "sequencer", "cinematic"]);
    expect(result).not.toBeNull();
  });

  it("returns null when no keywords match", () => {
    const result = detectPersona("hello world", []);
    expect(result).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(detectPersona("", [])).toBeNull();
    expect(detectPersona()).toBeNull();
  });

  it("normalizes confidence to 0-1 range", () => {
    const result = detectPersona(
      "blueprint gameplay prototype interaction UI level design save game inventory",
      ["blueprint", "UI", "gameplay"]
    );
    if (result) {
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("picks the highest-scoring persona", () => {
    // Heavy C++ keywords should map to logic_liam-like persona
    const result = detectPersona(
      "C++ architecture systems framework subsystem optimization programming",
      ["C++", "profiling"]
    );
    expect(result).not.toBeNull();
    expect(result.matchScore).toBeGreaterThanOrEqual(6);
  });
});

// ── getPainPointMessaging ────────────────────────────────────────────────
describe("getPainPointMessaging", () => {
  it("returns an array for a persona with onboardingMessaging", () => {
    const personas = getAllPersonas();
    const withMessaging = personas.find(
      (p) => Array.isArray(p.onboardingMessaging) && p.onboardingMessaging.length > 0
    );
    if (withMessaging) {
      const msgs = getPainPointMessaging(withMessaging);
      expect(Array.isArray(msgs)).toBe(true);
      expect(msgs.length).toBeGreaterThan(0);
    }
  });

  it("returns empty array for null persona", () => {
    expect(getPainPointMessaging(null)).toEqual([]);
  });

  it("returns empty array for persona without messaging", () => {
    expect(getPainPointMessaging({ id: "unknown" })).toEqual([]);
  });
});

// ── personaScoringRules ──────────────────────────────────────────────────
describe("personaScoringRules", () => {
  it("defines rules for known personas", () => {
    expect(personaScoringRules).toHaveProperty("indie_isaac");
    expect(personaScoringRules).toHaveProperty("logic_liam");
    expect(personaScoringRules).toHaveProperty("animator_alex");
  });

  it("each rule has required keys", () => {
    for (const [id, rule] of Object.entries(personaScoringRules)) {
      expect(rule).toHaveProperty("boostKeywords");
      expect(rule).toHaveProperty("penaltyKeywords");
      expect(rule).toHaveProperty("requiredTopics");
      expect(Array.isArray(rule.boostKeywords)).toBe(true);
      expect(rule.boostKeywords.length).toBeGreaterThan(0);
    }
  });
});
