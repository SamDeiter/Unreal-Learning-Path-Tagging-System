import { describe, it, expect } from "vitest";
import { buildKnowledgeProfile } from "../hooks/useAdaptiveQuiz";

describe("buildKnowledgeProfile", () => {
  // Helper to make a question with difficulty
  const q = (concept, difficulty = 1) => ({
    q: `Test ${concept}?`,
    options: ["A", "B", "C", "D"],
    correctIndex: 0,
    concept,
    difficulty,
  });

  // Helper to make an answer
  const ans = (questionIndex, correct, concept, unsure = false) => ({
    questionIndex,
    selectedOption: correct ? 0 : 1,
    concept,
    correct,
    unsure,
  });

  it("classifies as beginner when all wrong (0/8 weighted)", () => {
    const questions = [q("basics", 1), q("intermediate", 2), q("advanced", 3), q("applied", 2)];
    const answers = [
      ans(0, false, "basics"),
      ans(1, false, "intermediate"),
      ans(2, false, "advanced"),
      ans(3, false, "applied"),
    ];
    const profile = buildKnowledgeProfile(answers, questions);
    expect(profile.level).toBe("beginner");
    expect(profile.knows).toEqual([]);
    expect(profile.gaps).toEqual(["basics", "intermediate", "advanced", "applied"]);
  });

  it("classifies as advanced when all correct (8/8 weighted)", () => {
    const questions = [q("basics", 1), q("intermediate", 2), q("advanced", 3), q("applied", 2)];
    const answers = [
      ans(0, true, "basics"),
      ans(1, true, "intermediate"),
      ans(2, true, "advanced"),
      ans(3, true, "applied"),
    ];
    const profile = buildKnowledgeProfile(answers, questions);
    expect(profile.level).toBe("advanced");
    expect(profile.knows).toEqual(["basics", "intermediate", "advanced", "applied"]);
    expect(profile.gaps).toEqual([]);
  });

  it("classifies as intermediate when only beginner + applied correct (3/8 = 0.375 → intermediate boundary)", () => {
    // Score: 1 + 0 + 0 + 2 = 3, Max: 1 + 2 + 3 + 2 = 8, Ratio: 0.375
    // This is just below 0.4, so should be beginner
    const questions = [q("basics", 1), q("mid", 2), q("adv", 3), q("applied", 2)];
    const answers = [
      ans(0, true, "basics"),
      ans(1, false, "mid"),
      ans(2, false, "adv"),
      ans(3, true, "applied"),
    ];
    const profile = buildKnowledgeProfile(answers, questions);
    // 3/8 = 0.375, just under 0.4 threshold → beginner
    expect(profile.level).toBe("beginner");
  });

  it("classifies as intermediate when beginner + intermediate correct (3/8 = 0.375 exactly)", () => {
    // Score: 1 + 2 + 0 + 0 = 3, Max: 1 + 2 + 3 + 2 = 8, Ratio: 0.375
    const questions = [q("basics", 1), q("mid", 2), q("adv", 3), q("applied", 2)];
    const answers = [
      ans(0, true, "basics"),
      ans(1, true, "mid"),
      ans(2, false, "adv"),
      ans(3, false, "applied"),
    ];
    const profile = buildKnowledgeProfile(answers, questions);
    expect(profile.level).toBe("beginner");
  });

  it("weights advanced questions higher — only advanced correct = intermediate (3/8)", () => {
    // Score: 0 + 0 + 3 + 0 = 3, Max: 8, Ratio: 0.375
    const questions = [q("basics", 1), q("mid", 2), q("adv", 3), q("applied", 2)];
    const answers = [
      ans(0, false, "basics"),
      ans(1, false, "mid"),
      ans(2, true, "adv"),
      ans(3, false, "applied"),
    ];
    const profile = buildKnowledgeProfile(answers, questions);
    // Only advanced correct: 3/8 = 0.375, still beginner
    expect(profile.level).toBe("beginner");
  });

  it("advanced + intermediate correct = intermediate (5/8 = 0.625)", () => {
    // Score: 0 + 2 + 3 + 0 = 5, Max: 8, Ratio: 0.625
    const questions = [q("basics", 1), q("mid", 2), q("adv", 3), q("applied", 2)];
    const answers = [
      ans(0, false, "basics"),
      ans(1, true, "mid"),
      ans(2, true, "adv"),
      ans(3, false, "applied"),
    ];
    const profile = buildKnowledgeProfile(answers, questions);
    expect(profile.level).toBe("intermediate");
  });

  it("handles missing difficulty field gracefully (defaults to 1)", () => {
    const questions = [
      { q: "Q1?", options: ["A", "B", "C", "D"], correctIndex: 0, concept: "a" },
      { q: "Q2?", options: ["A", "B", "C", "D"], correctIndex: 0, concept: "b" },
    ];
    const answers = [ans(0, true, "a"), ans(1, true, "b")];
    const profile = buildKnowledgeProfile(answers, questions);
    // 2/2 = 1.0 → advanced
    expect(profile.level).toBe("advanced");
  });

  it("handles unsure answers as incorrect", () => {
    const questions = [q("basics", 1), q("mid", 2)];
    const answers = [ans(0, false, "basics", true), ans(1, false, "mid", true)];
    const profile = buildKnowledgeProfile(answers, questions);
    expect(profile.level).toBe("beginner");
    expect(profile.gaps).toEqual(["basics", "mid"]);
  });

  it("handles empty answers", () => {
    const profile = buildKnowledgeProfile([], []);
    expect(profile.level).toBe("beginner");
    expect(profile.knows).toEqual([]);
    expect(profile.gaps).toEqual([]);
  });
});
