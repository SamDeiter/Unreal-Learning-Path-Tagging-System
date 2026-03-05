import { describe, it, expect } from "vitest";

/**
 * Diagnostic Question Schema Validation
 *
 * These tests validate that diagnostic question responses
 * conform to the expected JSON schema. Uses static mock data
 * to avoid live API calls.
 */

// Valid mock response matching the prompt schema
const VALID_QUESTIONS = [
  {
    q: "What panel shows an Actor's components and properties?",
    options: ["Content Browser", "World Outliner", "Details Panel", "Output Log"],
    correctIndex: 2,
    concept: "editor_panels",
    difficulty: 1,
  },
  {
    q: "What happens when you set an Actor's Mobility to Stationary?",
    options: [
      "The actor cannot be moved at all",
      "The actor can receive baked lighting but cannot move at runtime",
      "The actor uses dynamic lighting only",
      "The actor is excluded from collision",
    ],
    correctIndex: 1,
    concept: "actor_mobility",
    difficulty: 2,
  },
  {
    q: "What is the correct workflow for replicating a variable across the network?",
    options: [
      "Mark it as Transient in the Details panel",
      "Use RepNotify and implement OnRep_ function",
      "Set it as a local variable in the Event Graph",
      "Add it to the Construction Script",
    ],
    correctIndex: 1,
    concept: "network_replication",
    difficulty: 3,
  },
  {
    q: "If your AI Behavior Tree keeps failing, what should you check first?",
    options: [
      "The material assignments on the AI character",
      "Whether the Blackboard keys are initialized correctly",
      "The audio settings for the AI",
      "The lighting setup in the level",
    ],
    correctIndex: 1,
    concept: "ai_debugging",
    difficulty: 2,
  },
];

function validateQuestion(q) {
  const errors = [];
  if (!q.q || typeof q.q !== "string") errors.push("Missing or invalid 'q' field");
  if (!Array.isArray(q.options)) errors.push("'options' is not an array");
  else if (q.options.length !== 4) errors.push(`Expected 4 options, got ${q.options.length}`);
  if (typeof q.correctIndex !== "number") errors.push("'correctIndex' is not a number");
  else if (q.correctIndex < 0 || q.correctIndex > 3)
    errors.push(`'correctIndex' out of range: ${q.correctIndex}`);
  if (!q.concept || typeof q.concept !== "string")
    errors.push("Missing or invalid 'concept' field");
  if (typeof q.difficulty !== "number") errors.push("Missing 'difficulty' field");
  else if (![1, 2, 3].includes(q.difficulty)) errors.push(`Invalid difficulty: ${q.difficulty}`);
  return errors;
}

describe("Diagnostic Question Schema", () => {
  describe("validateQuestion", () => {
    it("accepts valid questions with no errors", () => {
      for (const q of VALID_QUESTIONS) {
        expect(validateQuestion(q)).toEqual([]);
      }
    });

    it("rejects missing 'q' field", () => {
      const bad = { ...VALID_QUESTIONS[0], q: undefined };
      expect(validateQuestion(bad).length).toBeGreaterThan(0);
    });

    it("rejects non-array options", () => {
      const bad = { ...VALID_QUESTIONS[0], options: "not an array" };
      expect(validateQuestion(bad)).toContainEqual(expect.stringContaining("not an array"));
    });

    it("rejects wrong number of options", () => {
      const bad = { ...VALID_QUESTIONS[0], options: ["A", "B", "C"] };
      expect(validateQuestion(bad)).toContainEqual(expect.stringContaining("Expected 4"));
    });

    it("rejects correctIndex out of range", () => {
      const bad = { ...VALID_QUESTIONS[0], correctIndex: 5 };
      expect(validateQuestion(bad)).toContainEqual(expect.stringContaining("out of range"));
    });

    it("rejects missing concept", () => {
      const bad = { ...VALID_QUESTIONS[0], concept: undefined };
      expect(validateQuestion(bad).length).toBeGreaterThan(0);
    });

    it("rejects missing difficulty", () => {
      const bad = { ...VALID_QUESTIONS[0], difficulty: undefined };
      expect(validateQuestion(bad)).toContainEqual(expect.stringContaining("Missing 'difficulty'"));
    });

    it("rejects invalid difficulty values", () => {
      const bad = { ...VALID_QUESTIONS[0], difficulty: 4 };
      expect(validateQuestion(bad)).toContainEqual(expect.stringContaining("Invalid difficulty"));
    });
  });

  describe("Question ordering", () => {
    it("follows beginner → intermediate → advanced → applied order", () => {
      const expectedOrder = [1, 2, 3, 2];
      const actualOrder = VALID_QUESTIONS.map((q) => q.difficulty);
      expect(actualOrder).toEqual(expectedOrder);
    });

    it("has exactly 4 questions", () => {
      expect(VALID_QUESTIONS.length).toBe(4);
    });

    it("all concepts are unique", () => {
      const concepts = VALID_QUESTIONS.map((q) => q.concept);
      expect(new Set(concepts).size).toBe(concepts.length);
    });
  });
});
