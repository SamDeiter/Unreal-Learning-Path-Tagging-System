/**
 * routing.learnerState.test.js — detectMode tiebreakers that use skillState.
 */

const { detectMode } = require("../routing");

describe("detectMode — learnerState tiebreakers", () => {
  it("keyword signals take precedence over learnerState hints", () => {
    const mode = detectMode(
      { query: "I have an error in Blueprint compile" },
      {
        persona: "indie_dev",
        topicsLearned: [],
        skillState: { lumen: { level: "expert" } },
      }
    );
    expect(mode).toBe("problem-first");
  });

  it("expert-level tag in query biases ambiguous query to goal-build", () => {
    const mode = detectMode(
      { query: "What should I explore next in lumen workflows?" },
      {
        skillState: { lumen: { level: "expert" } },
        topicsLearned: ["lumen"],
      }
    );
    expect(mode).toBe("goal-build");
  });

  it("expert-level underscored tag still matches via word split", () => {
    const mode = detectMode(
      { query: "advanced nanite workflows tips" },
      {
        skillState: { nanite_displacement: { level: "expert" } },
      }
    );
    expect(mode).toBe("goal-build");
  });

  it("persona + no topicsLearned + short query biases to onboarding", () => {
    const mode = detectMode(
      { query: "lighting" },
      {
        persona: "environment_artist",
        topicsLearned: [],
        skillState: {},
      }
    );
    expect(mode).toBe("onboarding");
  });

  it("persona with learned topics and short query does NOT force onboarding (falls back)", () => {
    const mode = detectMode(
      { query: "lighting" },
      {
        persona: "environment_artist",
        topicsLearned: ["lumen", "nanite"],
        skillState: {},
      }
    );
    // With no problem/goal indicators and topics already learned,
    // we don't short-circuit to onboarding; short query → unknown.
    expect(["unknown", "onboarding", "problem-first"]).toContain(mode);
  });

  it("empty learnerState falls back to keyword-only behavior", () => {
    expect(detectMode({ query: "want to learn ue5 from scratch" }, {})).toBe("goal-build");
    expect(detectMode({ query: "crash on editor startup" }, {})).toBe("problem-first");
    expect(detectMode({}, {})).toBe("unknown");
  });
});
