/**
 * Unit tests for computeConfidence from queryLearningPath.js
 *
 * Duplicated here (same pattern as injectionGuard.test.js) so we can
 * test the pure scoring logic without the full Cloud Functions env.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Jest-compatible helpers for node:test
const expect = (val) => ({
  toBe: (expected) => assert.strictEqual(val, expected),
  toContain: (item) => {
    if (typeof val === 'string') assert.ok(val.includes(item), `Expected '${val}' to contain '${item}'`);
    else assert.ok(val.includes(item));
  },
  not: {
    toContain: (item) => {
      if (typeof val === 'string') assert.ok(!val.includes(item), `Expected '${val}' NOT to contain '${item}'`);
      else assert.ok(!val.includes(item));
    },
    toMatch: (re) => assert.ok(!re.test(val), `Expected '${val}' NOT to match ${re}`),
  },
  toMatch: (re) => assert.ok(re.test(val)),
  toBeLessThan: (n) => assert.ok(val < n, `Expected ${val} < ${n}`),
  toBeLessThanOrEqual: (n) => assert.ok(val <= n, `Expected ${val} <= ${n}`),
  toBeGreaterThan: (n) => assert.ok(val > n, `Expected ${val} > ${n}`),
  toBeGreaterThanOrEqual: (n) => assert.ok(val >= n, `Expected ${val} >= ${n}`),
});
const test = it;


// ── Exact copy of computeConfidence from queryLearningPath.js ──────────
function computeConfidence(intent, caseReport, passages, conversationHistory, query) {
  let score = 0;
  const reasons = [];

  // Intent has multiple identified systems
  if (intent.systems && intent.systems.length >= 2) {
    score += 30;
    reasons.push("multiple_systems_identified");
  } else if (intent.systems && intent.systems.length === 1) {
    score += 15;
    reasons.push("single_system_identified");
  }

  // Structured case report provides context
  if (caseReport) {
    if (caseReport.engineVersion) {
      score += 15;
      reasons.push("engine_version_provided");
    }
    if (caseReport.errorStrings && caseReport.errorStrings.length > 0) {
      score += 25;
      reasons.push("error_strings_provided");
    }
    if (caseReport.platform) {
      score += 5;
      reasons.push("platform_provided");
    }
    if (caseReport.whatChangedRecently) {
      score += 10;
      reasons.push("change_context_provided");
    }
  }

  // High-quality RAG passages (capped at 25)
  const goodPassages = (passages || []).filter((p) => (p.similarity || 0) > 0.4);
  if (goodPassages.length >= 2) {
    score += 25;
    reasons.push("strong_rag_matches");
  } else if (goodPassages.length === 1) {
    score += 15;
    reasons.push("partial_rag_match");
  }

  // Partial credit for decent passages (0.35–0.40 similarity)
  const decentPassages = (passages || []).filter(
    (p) => (p.similarity || 0) >= 0.35 && (p.similarity || 0) <= 0.4
  );
  if (decentPassages.length >= 2) {
    score += 10;
    reasons.push("decent_rag_matches");
  }

  // Multi-turn: each completed Q&A round adds confidence
  const history = Array.isArray(conversationHistory) ? conversationHistory : [];
  const completedRounds = history.filter((t) => t.role === "user").length;
  if (completedRounds > 0) {
    score += Math.min(completedRounds * 15, 45); // 15 pts per round, max 45
    reasons.push(`multi_turn_rounds_${completedRounds}`);
  }

  // ── Vagueness penalties ──────────────────────────────────────────
  const queryLen = (query || "").length;
  if (queryLen < 30) {
    score -= 15;
    reasons.push("short_query_penalty");
  }
  if (!caseReport && (!intent.systems || intent.systems.length < 2)) {
    const hasErrors = caseReport?.errorStrings?.length > 0;
    if (!hasErrors) {
      score -= 10;
      reasons.push("no_structured_context_penalty");
    }
  }

  return { score: Math.max(score, 0), reasons };
}
// ── End copy ───────────────────────────────────────────────────────────

const THRESHOLD = 50; // The current clarification threshold

// ── Helpers ────────────────────────────────────────────────────────────
const makePassages = (count, similarity = 0.5) =>
  Array.from({ length: count }, () => ({ text: "stub", similarity }));

const makeHistory = (rounds) => {
  const turns = [];
  for (let i = 0; i < rounds; i++) {
    turns.push({ role: "assistant", content: `Question ${i + 1}?` });
    turns.push({ role: "user", content: `Answer ${i + 1}` });
  }
  return turns;
};

// ═══════════════════════════════════════════════════════════════════════
//  1. VAGUE QUERIES → must trigger clarification (score < 50)
// ═══════════════════════════════════════════════════════════════════════
describe("computeConfidence — vague queries trigger clarification", () => {
  test("'my lighting looks wrong' (24 chars, 1 system, no case) → below threshold", () => {
    const result = computeConfidence(
      { systems: ["Lighting"] },
      null,
      makePassages(3, 0.5),
      [],
      "my lighting looks wrong"
    );
    expect(result.score).toBeLessThan(THRESHOLD);
    expect(result.reasons).toContain("short_query_penalty");
    expect(result.reasons).toContain("no_structured_context_penalty");
  });

  test("'it's not working' (17 chars, no systems) → near zero", () => {
    const result = computeConfidence(
      { systems: [] },
      null,
      makePassages(2, 0.5),
      [],
      "it's not working"
    );
    expect(result.score).toBeLessThan(THRESHOLD);
    expect(result.score).toBeLessThanOrEqual(10);
  });

  test("'mesh wrong' (10 chars, 1 system) → below threshold", () => {
    const result = computeConfidence(
      { systems: ["StaticMesh"] },
      null,
      makePassages(4, 0.6),
      [],
      "mesh wrong"
    );
    expect(result.score).toBeLessThan(THRESHOLD);
  });

  test("empty query → score floors at 0", () => {
    const result = computeConfidence({ systems: [] }, null, [], [], "");
    expect(result.score).toBe(0);
    expect(result.reasons).toContain("short_query_penalty");
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  2. SPECIFIC QUERIES → should skip clarification (score >= 50)
// ═══════════════════════════════════════════════════════════════════════
describe("computeConfidence — specific queries skip clarification", () => {
  test("detailed query + error log + engine version → high score", () => {
    const result = computeConfidence(
      { systems: ["Lighting", "Nanite"] },
      {
        engineVersion: "5.3",
        errorStrings: ["LogRenderer: Error: Lumen scene lighting out of memory"],
        platform: "Windows",
        whatChangedRecently: "Enabled Nanite on all meshes",
      },
      makePassages(3, 0.6),
      [],
      "Lumen GI flickering after enabling Nanite on all static meshes in my indoor scene"
    );
    expect(result.score).toBeGreaterThanOrEqual(THRESHOLD);
    expect(result.reasons).toContain("multiple_systems_identified");
    expect(result.reasons).toContain("error_strings_provided");
    expect(result.reasons).toContain("engine_version_provided");
    expect(result.reasons).not.toContain("short_query_penalty");
  });

  test("multi-system query + strong passages, no case report → above threshold", () => {
    const result = computeConfidence(
      { systems: ["Lighting", "PostProcess"] },
      null,
      makePassages(3, 0.55),
      [],
      "post-process bloom is washing out my Lumen reflections in an indoor scene"
    );
    // 30 (multi-system) + 25 (RAG) = 55, no short penalty (74 chars)
    expect(result.score).toBeGreaterThanOrEqual(THRESHOLD);
    expect(result.reasons).not.toContain("short_query_penalty");
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  3. MULTI-TURN ROUNDS → confidence rises with each Q&A round
// ═══════════════════════════════════════════════════════════════════════
describe("computeConfidence — multi-turn rounds boost confidence", () => {
  test("1 round adds 15 pts", () => {
    const base = computeConfidence(
      { systems: ["Lighting"] }, null, makePassages(2, 0.5), [], "my lighting looks wrong"
    );
    const after1 = computeConfidence(
      { systems: ["Lighting"] }, null, makePassages(2, 0.5), makeHistory(1), "my lighting looks wrong"
    );
    expect(after1.score - base.score).toBe(15);
    expect(after1.reasons).toContain("multi_turn_rounds_1");
  });

  test("3 rounds = 45 pts (max cap)", () => {
    const result = computeConfidence(
      { systems: ["Lighting"] }, null, makePassages(2, 0.5), makeHistory(3), "my lighting looks wrong"
    );
    expect(result.reasons).toContain("multi_turn_rounds_3");
    // After 3 rounds a vague query should finally clear the threshold:
    // 15 (system) + 25 (RAG) + 45 (rounds) - 15 (short) - 10 (no context) = 60
    expect(result.score).toBeGreaterThanOrEqual(THRESHOLD);
  });

  test("4+ rounds still capped at 45 pts", () => {
    const r3 = computeConfidence(
      { systems: ["Lighting"] }, null, [], makeHistory(3), "short"
    );
    const r5 = computeConfidence(
      { systems: ["Lighting"] }, null, [], makeHistory(5), "short"
    );
    // The multi-turn contribution should be the same (capped)
    expect(r5.score).toBe(r3.score);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  4. RAG PASSAGE SCORING
// ═══════════════════════════════════════════════════════════════════════
describe("computeConfidence — RAG passage contribution", () => {
  test("0 good passages → no RAG bonus", () => {
    const result = computeConfidence(
      { systems: ["Blueprint"] }, null, makePassages(5, 0.3), [],
      "my blueprint is broken and I don't know why"
    );
    expect(result.reasons).not.toContain("strong_rag_matches");
    expect(result.reasons).not.toContain("partial_rag_match");
  });

  test("1 good passage → 15 pts partial match", () => {
    const result = computeConfidence(
      { systems: ["Blueprint"] }, null,
      [{ text: "a", similarity: 0.5 }, { text: "b", similarity: 0.3 }],
      [],
      "my blueprint is broken and I don't know why"
    );
    expect(result.reasons).toContain("partial_rag_match");
    expect(result.reasons).not.toContain("strong_rag_matches");
  });

  test("2+ good passages → capped at 25 pts", () => {
    const result = computeConfidence(
      { systems: [] }, null, makePassages(5, 0.6), [],
      "my blueprint is broken and I don't know why"
    );
    expect(result.reasons).toContain("strong_rag_matches");
    // RAG alone (25) minus penalties should not bypass threshold
    // 0 (no systems) + 25 (RAG) - 10 (no context) = 15
    expect(result.score).toBeLessThan(THRESHOLD);
  });

  test("decent passages (0.35-0.40) add 10 pts", () => {
    const result = computeConfidence(
      { systems: ["Lighting"] }, null,
      [{ text: "a", similarity: 0.37 }, { text: "b", similarity: 0.38 }],
      [],
      "my lighting is blinking really weirdly in this scene"
    );
    expect(result.reasons).toContain("decent_rag_matches");
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  5. CASE REPORT SCORING
// ═══════════════════════════════════════════════════════════════════════
describe("computeConfidence — case report boosts", () => {
  test("full case report (engine + errors + platform + change) adds 55 pts", () => {
    const result = computeConfidence(
      { systems: [] },
      {
        engineVersion: "5.4",
        errorStrings: ["Fatal error"],
        platform: "Windows",
        whatChangedRecently: "Updated engine",
      },
      [],
      [],
      "my project won't open after I updated the engine version"
    );
    // 0 (systems) + 15+25+5+10 (case) + 0 (RAG) + 0 (rounds) - 0 (long query) - 0 (has case) = 55
    expect(result.score).toBe(55);
    expect(result.reasons).toContain("engine_version_provided");
    expect(result.reasons).toContain("error_strings_provided");
    expect(result.reasons).toContain("platform_provided");
    expect(result.reasons).toContain("change_context_provided");
    expect(result.reasons).not.toContain("no_structured_context_penalty");
  });

  test("case report prevents no_structured_context_penalty", () => {
    const withCase = computeConfidence(
      { systems: ["Lighting"] },
      { engineVersion: "5.3" },
      [],
      [],
      "lights broken"
    );
    const withoutCase = computeConfidence(
      { systems: ["Lighting"] },
      null,
      [],
      [],
      "lights broken"
    );
    expect(withoutCase.reasons).toContain("no_structured_context_penalty");
    expect(withCase.reasons).not.toContain("no_structured_context_penalty");
    expect(withCase.score).toBeGreaterThan(withoutCase.score);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  6. EDGE CASES
// ═══════════════════════════════════════════════════════════════════════
describe("computeConfidence — edge cases", () => {
  test("null/undefined passages → no crash", () => {
    const result = computeConfidence({ systems: [] }, null, null, null, "test");
    expect(result.score).toBe(0);
  });

  test("score never goes negative (floors at 0)", () => {
    const result = computeConfidence({ systems: [] }, null, [], [], "hi");
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  test("query exactly 30 chars does NOT get short penalty", () => {
    const query30 = "a".repeat(30);
    const result = computeConfidence({ systems: [] }, null, [], [], query30);
    expect(result.reasons).not.toContain("short_query_penalty");
  });

  test("query 29 chars DOES get short penalty", () => {
    const query29 = "a".repeat(29);
    const result = computeConfidence({ systems: [] }, null, [], [], query29);
    expect(result.reasons).toContain("short_query_penalty");
  });
});
