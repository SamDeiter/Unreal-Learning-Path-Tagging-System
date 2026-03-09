/**
 * studyGuideGenerator — Unit tests
 *
 * Tests content summary building, Bloom's enrichment,
 * flashcard generation, and quick quiz creation.
 */

import { describe, it, expect } from "vitest";
import {
  buildContentSummary,
  enrichGuideWithBloom,
  generateFlashcards,
  generateQuickQuiz,
} from "../../services/studyGuideGenerator";

const makeCourse = (code, title, opts = {}) => ({
  code,
  title,
  tags: { topic: opts.topic || "General", level: opts.level || "Intermediate" },
  videos: opts.videos || [{ duration_minutes: 30 }],
  duration: opts.duration || 0.5,
  gemini_enriched: {
    one_sentence_summary: opts.summary || `Summary of ${title}`,
    learning_outcomes: opts.outcomes || [`Learn about ${title}`],
    system_tags: opts.tags || ["tag1", "tag2", "tag3"],
  },
  extracted_tags: opts.extractedTags || ["etag1", "etag2"],
});

describe("studyGuideGenerator", () => {
  describe("buildContentSummary", () => {
    it("extracts course summaries with topics", () => {
      const courses = [
        makeCourse("C1", "Blueprint Basics", { topic: "Blueprints" }),
        makeCourse("C2", "Material Setup", { topic: "Materials" }),
      ];
      const result = buildContentSummary(courses);
      expect(result.courses).toHaveLength(2);
      expect(result.topics).toContain("Blueprints");
      expect(result.topics).toContain("Materials");
    });

    it("calculates total duration", () => {
      const courses = [
        makeCourse("C1", "Course 1", { duration: 1.5 }),
        makeCourse("C2", "Course 2", { duration: 2.0 }),
      ];
      const result = buildContentSummary(courses);
      expect(result.totalDuration).toBe(3.5);
    });

    it("deduplicates topics", () => {
      const courses = [
        makeCourse("C1", "Intro", { topic: "Blueprints" }),
        makeCourse("C2", "Advanced", { topic: "Blueprints" }),
      ];
      const result = buildContentSummary(courses);
      expect(result.topics).toHaveLength(1);
    });

    it("handles empty courses", () => {
      const result = buildContentSummary([]);
      expect(result.courses).toEqual([]);
      expect(result.topics).toEqual([]);
      expect(result.totalDuration).toBe(0);
    });
  });

  describe("enrichGuideWithBloom", () => {
    it("adds bloom metadata to sections", () => {
      const guide = {
        title: "Test Guide",
        sections: [
          { heading: "Introduction to Blueprints", content: "Basics overview" },
          { heading: "How to create a material", content: "Step by step tutorial" },
        ],
      };
      const result = enrichGuideWithBloom(guide);
      expect(result.sections[0].bloom).toBeDefined();
      expect(result.sections[0].bloom.level).toBeDefined();
      expect(result.sections[0].bloom.emoji).toBeDefined();
      expect(result.sections[0].bloom.color).toBeDefined();
    });

    it("handles guide with no sections", () => {
      const guide = { title: "Empty Guide" };
      const result = enrichGuideWithBloom(guide);
      expect(result.title).toBe("Empty Guide");
    });
  });

  describe("generateFlashcards", () => {
    it("generates cards from learning outcomes", () => {
      const courses = [
        makeCourse("C1", "Blueprint Basics", {
          outcomes: ["Create a basic Blueprint", "Use variables in Blueprints"],
        }),
      ];
      const cards = generateFlashcards(courses);
      expect(cards.length).toBeGreaterThanOrEqual(2);
      cards.forEach((card) => {
        expect(card.front).toBeDefined();
        expect(card.back).toBeDefined();
        expect(card.topic).toBeDefined();
      });
    });

    it("includes summary as flashcard", () => {
      const courses = [
        makeCourse("C1", "BP Intro", { summary: "Introduction to visual scripting" }),
      ];
      const cards = generateFlashcards(courses);
      const summaryCard = cards.find((c) => c.front.includes("Summarize"));
      expect(summaryCard).toBeDefined();
    });

    it("handles courses without enriched data", () => {
      const courses = [
        {
          code: "C1",
          title: "Plain Course",
          tags: {},
          gemini_enriched: {},
        },
      ];
      const cards = generateFlashcards(courses);
      // Should not crash
      expect(Array.isArray(cards)).toBe(true);
    });
  });

  describe("generateQuickQuiz", () => {
    it("generates questions from course outcomes", () => {
      const courses = [
        makeCourse("C1", "Blueprint Basics", {
          outcomes: ["Create Blueprints", "Use variables"],
          tags: ["blueprints", "variables", "scripting"],
        }),
      ];
      const questions = generateQuickQuiz(courses);
      expect(questions.length).toBeGreaterThan(0);
      questions.forEach((q) => {
        expect(q.question).toBeDefined();
        expect(q.options.length).toBe(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.explanation).toBeDefined();
      });
    });

    it("respects questionsPerCourse limit", () => {
      const courses = [
        makeCourse("C1", "BP Intro", {
          outcomes: ["a", "b", "c"],
          tags: ["t1", "t2", "t3"],
        }),
      ];
      const questions1 = generateQuickQuiz(courses, { questionsPerCourse: 1 });
      const questions2 = generateQuickQuiz(courses, { questionsPerCourse: 2 });
      expect(questions2.length).toBeGreaterThanOrEqual(questions1.length);
    });

    it("handles empty courses", () => {
      const questions = generateQuickQuiz([]);
      expect(questions).toEqual([]);
    });
  });
});
