import { describe, it, expect } from "vitest";
import {
  normalizeQuery,
  depluralize,
  UE_ABBREVIATIONS,
  NEGATIVE_PATTERNS,
} from "../../services/QueryNormalizer";

// ─── normalizeQuery ──────────────────────────────────────────

describe("normalizeQuery", () => {
  it("returns empty result for null/undefined input", () => {
    expect(normalizeQuery(null)).toEqual({ normalized: "", expandedTerms: [], negatedTerms: [] });
    expect(normalizeQuery(undefined)).toEqual({ normalized: "", expandedTerms: [], negatedTerms: [] });
    expect(normalizeQuery("")).toEqual({ normalized: "", expandedTerms: [], negatedTerms: [] });
  });

  it("lowercases the query", () => {
    const { normalized } = normalizeQuery("BLUEPRINT");
    expect(normalized).toContain("blueprint");
  });

  it("expands UE abbreviations", () => {
    const { normalized, expandedTerms } = normalizeQuery("bp setup");
    expect(normalized).toContain("blueprint");
    expect(expandedTerms.length).toBeGreaterThan(0);
    expect(expandedTerms.some((t) => t.includes("bp"))).toBe(true);
  });

  it("expands multiple abbreviations in one query", () => {
    const { normalized } = normalizeQuery("bp with vfx and gi");
    expect(normalized).toContain("blueprint");
    expect(normalized).toContain("visual effects");
    expect(normalized).toContain("global illumination");
  });

  it("splits camelCase words", () => {
    const { normalized } = normalizeQuery("BlueprintCompiler");
    expect(normalized).toContain("blueprint");
    expect(normalized).toContain("compiler");
  });

  it("splits snake_case words", () => {
    const { normalized } = normalizeQuery("world_partition");
    expect(normalized).toContain("world");
    expect(normalized).toContain("partition");
  });

  it("strips punctuation but preserves hyphens and plus signs", () => {
    const { normalized } = normalizeQuery("c++ ray-tracing! what?");
    expect(normalized).toContain("c++");
    expect(normalized).toContain("ray-tracing");
    expect(normalized).not.toContain("!");
    expect(normalized).not.toContain("?");
  });

  it("collapses extra whitespace", () => {
    const { normalized } = normalizeQuery("  blueprint   with   spaces  ");
    expect(normalized).not.toMatch(/  /); // No double spaces
    expect(normalized).toBe(normalized.trim());
  });
});

// ─── Negative Intent Detection ───────────────────────────────

describe("normalizeQuery — negative intent", () => {
  it('detects "not X" patterns', () => {
    const { negatedTerms } = normalizeQuery("lighting not niagara");
    expect(negatedTerms).toContain("niagara");
  });

  it('detects "without X" patterns', () => {
    const { negatedTerms } = normalizeQuery("animation without rigging");
    expect(negatedTerms).toContain("rigging");
  });

  it('detects "exclude X" patterns', () => {
    const { negatedTerms } = normalizeQuery("materials exclude pbr");
    expect(negatedTerms).toContain("pbr");
  });

  it('detects "don\'t want X" patterns', () => {
    const { negatedTerms } = normalizeQuery("I don't want audio");
    expect(negatedTerms).toContain("audio");
  });

  it("returns empty negatedTerms when no negation present", () => {
    const { negatedTerms } = normalizeQuery("blueprint setup");
    expect(negatedTerms).toEqual([]);
  });
});

// ─── depluralize ─────────────────────────────────────────────

describe("depluralize", () => {
  it("returns short words unchanged (< 4 chars)", () => {
    expect(depluralize("bus")).toBe("bus");
    expect(depluralize("as")).toBe("as");
  });

  it("strips trailing s from normal plurals", () => {
    expect(depluralize("blueprints")).toBe("blueprint");
    expect(depluralize("materials")).toBe("material");
  });

  it('converts "ies" → "y"', () => {
    expect(depluralize("queries")).toBe("query");
    expect(depluralize("categories")).toBe("category");
  });

  it("handles safe-list words that should NOT be depluralized", () => {
    expect(depluralize("chaos")).toBe("chaos");
    expect(depluralize("physics")).toBe("physics");
    expect(depluralize("atlas")).toBe("atlas");
    expect(depluralize("analysis")).toBe("analysis");
    expect(depluralize("class")).toBe("class");
  });

  it("does not strip ss endings", () => {
    expect(depluralize("grass")).toBe("grass");
    expect(depluralize("mass")).toBe("mass");
  });

  it("returns null/empty unchanged", () => {
    expect(depluralize("")).toBe("");
    expect(depluralize(null)).toBe(null);
    expect(depluralize(undefined)).toBe(undefined);
  });
});

// ─── UE Abbreviations ───────────────────────────────────────

describe("UE_ABBREVIATIONS", () => {
  it("is a Map with at least 20 entries", () => {
    expect(UE_ABBREVIATIONS instanceof Map).toBe(true);
    expect(UE_ABBREVIATIONS.size).toBeGreaterThanOrEqual(20);
  });

  it("contains key UE5 abbreviations", () => {
    expect(UE_ABBREVIATIONS.get("bp")).toBe("blueprint");
    expect(UE_ABBREVIATIONS.get("vfx")).toBe("visual effects");
    expect(UE_ABBREVIATIONS.get("gi")).toBe("global illumination");
    expect(UE_ABBREVIATIONS.get("umg")).toBe("unreal motion graphics");
    expect(UE_ABBREVIATIONS.get("ue5")).toBe("unreal engine 5");
  });
});

// ─── NEGATIVE_PATTERNS ──────────────────────────────────────

describe("NEGATIVE_PATTERNS", () => {
  it("is an array of regex patterns", () => {
    expect(Array.isArray(NEGATIVE_PATTERNS)).toBe(true);
    expect(NEGATIVE_PATTERNS.length).toBeGreaterThanOrEqual(4);
    for (const p of NEGATIVE_PATTERNS) {
      expect(p).toBeInstanceOf(RegExp);
    }
  });
});
