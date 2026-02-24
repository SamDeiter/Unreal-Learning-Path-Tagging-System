import { describe, it, expect } from "vitest";
import {
  createIntent,
  validateIntent,
  createDiagnosis,
  validateDiagnosis,
  createLearningObjectives,
  validateLearningObjectives,
  createAdaptiveLearningCart,
} from "../domainTypes";

// ── createIntent ────────────────────────────────────────────────────

describe("createIntent", () => {
  it("returns an object with all expected fields", () => {
    const intent = createIntent("artist", "fix lighting", "My shadows are wrong");
    expect(intent.intent_id).toMatch(/^intent_/);
    expect(intent.user_role).toBe("artist");
    expect(intent.goal).toBe("fix lighting");
    expect(intent.problem_description).toBe("My shadows are wrong");
    expect(intent.systems).toEqual([]);
    expect(intent.constraints).toEqual([]);
    expect(intent.created_at).toBeTruthy();
  });

  it("accepts systems and constraints arrays", () => {
    const intent = createIntent("dev", "perf", "Lag", ["Niagara"], ["PS5"]);
    expect(intent.systems).toEqual(["Niagara"]);
    expect(intent.constraints).toEqual(["PS5"]);
  });

  it("defaults empty strings for missing args", () => {
    const intent = createIntent();
    expect(intent.user_role).toBe("unknown");
    expect(intent.goal).toBe("");
    expect(intent.problem_description).toBe("");
  });

  it("coerces non-array systems/constraints to empty arrays", () => {
    const intent = createIntent("a", "b", "c", "notArray", 123);
    expect(intent.systems).toEqual([]);
    expect(intent.constraints).toEqual([]);
  });
});

// ── validateIntent ──────────────────────────────────────────────────

describe("validateIntent", () => {
  it("validates a correct intent", () => {
    const intent = createIntent("a", "b", "a long problem description here");
    const result = validateIntent(intent);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects missing intent_id prefix", () => {
    const result = validateIntent({
      intent_id: "bad",
      problem_description: "a long problem",
      systems: [],
      constraints: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("intent_id"));
  });

  it("rejects short problem_description", () => {
    const intent = createIntent("a", "b", "short");
    const result = validateIntent(intent);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("problem_description"));
  });

  it("rejects non-array systems", () => {
    const intent = createIntent("a", "b", "valid long description");
    intent.systems = "notArray";
    const result = validateIntent(intent);
    expect(result.valid).toBe(false);
  });
});

// ── createDiagnosis ─────────────────────────────────────────────────

describe("createDiagnosis", () => {
  it("returns an object with all expected fields", () => {
    const diag = createDiagnosis("Shadow bleeding on dynamic meshes", ["Bad light channel"]);
    expect(diag.diagnosis_id).toMatch(/^diag_/);
    expect(diag.problem_summary).toBe("Shadow bleeding on dynamic meshes");
    expect(diag.root_causes).toEqual(["Bad light channel"]);
    expect(diag.signals_to_watch_for).toEqual([]);
    expect(diag.variables_that_matter).toEqual([]);
    expect(diag.variables_that_do_not).toEqual([]);
    expect(diag.generalization_scope).toEqual([]);
  });

  it("defaults empty string for missing summary", () => {
    const diag = createDiagnosis();
    expect(diag.problem_summary).toBe("");
  });

  it("coerces non-array params to empty arrays", () => {
    const diag = createDiagnosis("summary", "notArray", 123);
    expect(diag.root_causes).toEqual([]);
    expect(diag.signals_to_watch_for).toEqual([]);
  });
});

// ── validateDiagnosis ───────────────────────────────────────────────

describe("validateDiagnosis", () => {
  it("validates a correct diagnosis", () => {
    const diag = createDiagnosis("Shadow bleeding on dynamic meshes", ["Bad light channel"]);
    const result = validateDiagnosis(diag);
    expect(result.valid).toBe(true);
  });

  it("rejects missing diagnosis_id prefix", () => {
    const result = validateDiagnosis({
      diagnosis_id: "nope",
      problem_summary: "valid summary here",
      root_causes: ["a"],
      signals_to_watch_for: [],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects short problem_summary", () => {
    const diag = createDiagnosis("short", ["cause"]);
    const result = validateDiagnosis(diag);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("problem_summary"));
  });

  it("rejects empty root_causes", () => {
    const diag = createDiagnosis("Valid long summary here");
    const result = validateDiagnosis(diag);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("root_causes"));
  });
});

// ── createLearningObjectives ────────────────────────────────────────

describe("createLearningObjectives", () => {
  it("returns fix_specific and transferable arrays", () => {
    const obj = createLearningObjectives(["fix lumen"], ["understand GI"]);
    expect(obj.fix_specific).toEqual(["fix lumen"]);
    expect(obj.transferable).toEqual(["understand GI"]);
    expect(obj.created_at).toBeTruthy();
  });

  it("defaults to empty arrays", () => {
    const obj = createLearningObjectives();
    expect(obj.fix_specific).toEqual([]);
    expect(obj.transferable).toEqual([]);
  });
});

// ── validateLearningObjectives ──────────────────────────────────────

describe("validateLearningObjectives", () => {
  it("validates objectives with a transferable objective", () => {
    const obj = createLearningObjectives(["fix it"], ["learn the concept"]);
    const result = validateLearningObjectives(obj);
    expect(result.valid).toBe(true);
  });

  it("rejects objectives with no transferable (ANTI-TUTORIAL-HELL)", () => {
    const obj = createLearningObjectives(["fix it"], []);
    const result = validateLearningObjectives(obj);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("ANTI-TUTORIAL-HELL"));
  });

  it("rejects non-array fix_specific", () => {
    const result = validateLearningObjectives({ fix_specific: "bad", transferable: ["ok"] });
    expect(result.valid).toBe(false);
  });
});

// ── createAdaptiveLearningCart ───────────────────────────────────────

describe("createAdaptiveLearningCart", () => {
  it("returns a cart with all fields", () => {
    const intent = createIntent("a", "b", "long problem description");
    const diag = createDiagnosis("long problem summary text", ["cause"]);
    const obj = createLearningObjectives([], ["transferable"]);
    const cart = createAdaptiveLearningCart(intent, diag, obj, [{ code: "C01" }]);

    expect(cart.cart_id).toMatch(/^cart_/);
    expect(cart.intent).toBe(intent);
    expect(cart.diagnosis).toBe(diag);
    expect(cart.objectives).toBe(obj);
    expect(cart.recommended_courses).toHaveLength(1);
  });

  it("defaults recommended_courses to empty array", () => {
    const cart = createAdaptiveLearningCart(null, null, null);
    expect(cart.recommended_courses).toEqual([]);
  });
});
