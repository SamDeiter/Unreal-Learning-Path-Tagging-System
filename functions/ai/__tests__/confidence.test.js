/**
 * confidence.test.js — Tests for confidence scoring
 */

const { computeConfidence } = require("../confidence");

describe("computeConfidence", () => {
  describe("intent scoring", () => {
    it("scores 30 for multiple systems identified", () => {
      const { score, reasons } = computeConfidence(
        { systems: ["Niagara", "Blueprints"] },
        null, [], [], "How do I connect Niagara to Blueprints?"
      );
      expect(reasons).toContain("multiple_systems_identified");
      expect(score).toBeGreaterThanOrEqual(15); // 30 - 15 for no case report
    });

    it("scores 15 for single system identified", () => {
      const { reasons } = computeConfidence(
        { systems: ["Niagara"] },
        null, [], [], "How does Niagara work with particle collision?"
      );
      expect(reasons).toContain("single_system_identified");
    });
  });

  describe("case report scoring", () => {
    it("scores for engine version", () => {
      const { reasons } = computeConfidence(
        { systems: [] },
        { engineVersion: "5.4" },
        [], [], "Help with materials in UE5"
      );
      expect(reasons).toContain("engine_version_provided");
    });

    it("scores for error strings", () => {
      const { reasons } = computeConfidence(
        { systems: [] },
        { errorStrings: ["NullPointerException"] },
        [], [], "My blueprint crashes with an error"
      );
      expect(reasons).toContain("error_strings_provided");
    });

    it("scores for platform", () => {
      const { reasons } = computeConfidence(
        { systems: [] },
        { platform: "Windows" },
        [], [], "Help with materials in UE5"
      );
      expect(reasons).toContain("platform_provided");
    });

    it("scores for change context", () => {
      const { reasons } = computeConfidence(
        { systems: [] },
        { whatChangedRecently: "Updated to 5.4" },
        [], [], "Something broke after update"
      );
      expect(reasons).toContain("change_context_provided");
    });
  });

  describe("RAG passage scoring", () => {
    it("scores for strong RAG matches", () => {
      const passages = [
        { similarity: 0.8 },
        { similarity: 0.6 },
      ];
      const { reasons } = computeConfidence(
        { systems: ["Niagara"] }, null, passages, [],
        "How to use Niagara particle collision"
      );
      expect(reasons).toContain("strong_rag_matches");
    });

    it("scores for partial RAG match", () => {
      const passages = [{ similarity: 0.5 }];
      const { reasons } = computeConfidence(
        { systems: ["Niagara"] }, null, passages, [],
        "How to use Niagara particle collision"
      );
      expect(reasons).toContain("partial_rag_match");
    });

    it("scores for decent RAG matches (0.35-0.40)", () => {
      const passages = [
        { similarity: 0.36 },
        { similarity: 0.38 },
      ];
      const { reasons } = computeConfidence(
        { systems: [] }, null, passages, [],
        "How do I use the landscape tool in UE5?"
      );
      expect(reasons).toContain("decent_rag_matches");
    });
  });

  describe("multi-turn scoring", () => {
    it("adds confidence per conversation round", () => {
      const history = [
        { role: "user", content: "Q1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "Q2" },
      ];
      const { reasons } = computeConfidence(
        { systems: [] }, null, [], history,
        "What about the material setup?"
      );
      expect(reasons).toContain("multi_turn_rounds_2");
    });

    it("caps multi-turn bonus at 45", () => {
      const history = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Turn ${i}`,
      }));
      const { score } = computeConfidence(
        { systems: [] }, null, [], history,
        "What's the best approach for this?"
      );
      // 5 user turns × 15 = 75, capped at 45, minus penalties
      expect(score).toBeLessThanOrEqual(45);
    });
  });

  describe("vagueness penalties", () => {
    it("penalizes short queries", () => {
      const { reasons } = computeConfidence(
        { systems: [] }, null, [], [], "help"
      );
      expect(reasons).toContain("short_query_penalty");
    });

    it("penalizes no structured context", () => {
      const { reasons } = computeConfidence(
        { systems: [] }, null, [], [], "Something is wrong"
      );
      expect(reasons).toContain("no_structured_context_penalty");
    });
  });

  describe("edge cases", () => {
    it("never returns negative score", () => {
      const { score } = computeConfidence({}, null, [], [], "");
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("throws on null intent (no null guard)", () => {
      expect(() => computeConfidence(null, null, null, null, null)).toThrow();
    });

    it("handles empty object intent", () => {
      const { score, reasons } = computeConfidence({}, null, [], [], "test query");
      expect(typeof score).toBe("number");
      expect(Array.isArray(reasons)).toBe(true);
    });
  });

  describe("high vs low confidence scenarios", () => {
    it("produces high score for rich context", () => {
      const { score } = computeConfidence(
        { systems: ["Niagara", "Blueprints"] },
        { engineVersion: "5.4", errorStrings: ["Crash in FNiagaraSystemInstance"], platform: "Windows" },
        [{ similarity: 0.85 }, { similarity: 0.72 }],
        [{ role: "user", content: "Q1" }, { role: "assistant", content: "A1" }],
        "My Niagara system crashes at runtime when connected to a Blueprint event dispatcher"
      );
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it("produces low score for vague query", () => {
      const { score } = computeConfidence(
        { systems: [] }, null, [], [], "help"
      );
      expect(score).toBeLessThanOrEqual(5);
    });
  });
});
