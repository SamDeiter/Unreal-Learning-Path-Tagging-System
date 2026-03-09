/**
 * cognitiveLoadEngine — Unit tests
 *
 * Tests load estimation, interleaving, review checkpoints,
 * and load summary.
 */

import { describe, it, expect } from "vitest";
import {
  estimateCognitiveLoad,
  interleaveCourses,
  insertReviewCheckpoints,
  getLoadSummary,
} from "../../services/cognitiveLoadEngine";

const makeCourse = (code, title, level = "Intermediate", opts = {}) => ({
  code,
  title,
  tags: { level },
  videos: opts.videos || [{ duration_minutes: 30 }],
  duration: opts.duration || 0.5,
  gemini_enriched: { one_sentence_summary: opts.summary || "" },
});

describe("cognitiveLoadEngine", () => {
  describe("estimateCognitiveLoad", () => {
    it("estimates lower load for beginner courses", () => {
      const beginner = makeCourse("A", "Introduction to Blueprints", "Beginner");
      const advanced = makeCourse("B", "Design a custom pipeline from scratch", "Advanced");
      const bLoad = estimateCognitiveLoad(beginner);
      const aLoad = estimateCognitiveLoad(advanced);
      expect(bLoad.load).toBeLessThan(aLoad.load);
    });

    it("returns load between 0 and 10", () => {
      const course = makeCourse("A", "Some course", "Intermediate");
      const result = estimateCognitiveLoad(course);
      expect(result.load).toBeGreaterThanOrEqual(0);
      expect(result.load).toBeLessThanOrEqual(10);
    });

    it("includes bloom level in factors", () => {
      const course = makeCourse("A", "How to create a material");
      const result = estimateCognitiveLoad(course);
      expect(result.factors.bloomLevel).toBeDefined();
      expect(result.factors.bloomLoad).toBeGreaterThan(0);
    });

    it("accounts for high video count", () => {
      const fewVideos = makeCourse("A", "Tutorial", "Intermediate", {
        videos: [{ duration_minutes: 30 }],
      });
      const manyVideos = makeCourse("B", "Tutorial", "Intermediate", {
        videos: Array(10).fill({ duration_minutes: 30 }),
      });
      const fewLoad = estimateCognitiveLoad(fewVideos);
      const manyLoad = estimateCognitiveLoad(manyVideos);
      expect(manyLoad.load).toBeGreaterThanOrEqual(fewLoad.load);
    });
  });

  describe("interleaveCourses", () => {
    it("returns annotated courses for small lists", () => {
      const courses = [makeCourse("A", "Intro", "Beginner")];
      const result = interleaveCourses(courses);
      expect(result).toHaveLength(1);
      expect(result[0].cognitiveLoad).toBeDefined();
    });

    it("interleaves high and low load courses", () => {
      const courses = [
        makeCourse("H1", "Design a custom system", "Advanced"),
        makeCourse("H2", "Design a complex pipeline", "Advanced"),
        makeCourse("H3", "Design a master algorithm", "Advanced"),
        makeCourse("L1", "Introduction to basics", "Beginner"),
        makeCourse("L2", "Overview of fundamentals", "Beginner"),
      ];
      const result = interleaveCourses(courses);
      expect(result).toHaveLength(5);

      // Should not have 3+ consecutive high-load courses
      let consecutiveHigh = 0;
      let maxConsecutive = 0;
      result.forEach((c) => {
        if (c.cognitiveLoad.load >= 4) {
          consecutiveHigh++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveHigh);
        } else {
          consecutiveHigh = 0;
        }
      });
      expect(maxConsecutive).toBeLessThanOrEqual(2);
    });

    it("preserves all courses", () => {
      const courses = [
        makeCourse("A", "Test 1", "Beginner"),
        makeCourse("B", "Test 2", "Advanced"),
        makeCourse("C", "Test 3", "Intermediate"),
      ];
      const result = interleaveCourses(courses);
      const codes = result.map((c) => c.code).sort();
      expect(codes).toEqual(["A", "B", "C"]);
    });
  });

  describe("insertReviewCheckpoints", () => {
    it("skips checkpoints for short lists", () => {
      const courses = [makeCourse("A", "Test 1"), makeCourse("B", "Test 2")];
      const result = insertReviewCheckpoints(courses);
      expect(result.filter((r) => r.type === "review_checkpoint")).toHaveLength(0);
    });

    it("inserts checkpoints every N courses", () => {
      const courses = Array.from({ length: 7 }, (_, i) => makeCourse(`C${i}`, `Course ${i}`));
      const result = insertReviewCheckpoints(courses, { reviewInterval: 3 });
      const checkpoints = result.filter((r) => r.type === "review_checkpoint");
      expect(checkpoints.length).toBeGreaterThan(0);
    });

    it("includes review topics in checkpoints", () => {
      const courses = Array.from({ length: 4 }, (_, i) => makeCourse(`C${i}`, `Course ${i}`));
      const result = insertReviewCheckpoints(courses, { reviewInterval: 3 });
      const cp = result.find((r) => r.type === "review_checkpoint");
      expect(cp).toBeDefined();
      expect(cp.topics.length).toBeGreaterThan(0);
      expect(cp.suggestion).toBeDefined();
    });
  });

  describe("getLoadSummary", () => {
    it("returns zero summary for empty list", () => {
      const result = getLoadSummary([]);
      expect(result.avg).toBe(0);
    });

    it("calculates correct averages", () => {
      const courses = [
        makeCourse("A", "Introduction", "Beginner"),
        makeCourse("B", "Advanced design from scratch", "Advanced"),
      ];
      const annotated = courses.map((c) => ({
        ...c,
        cognitiveLoad: estimateCognitiveLoad(c),
      }));
      const summary = getLoadSummary(annotated);
      expect(summary.avg).toBeGreaterThan(0);
      expect(summary.max).toBeGreaterThanOrEqual(summary.min);
      expect(summary.totalCourses).toBe(2);
    });

    it("excludes review checkpoints from stats", () => {
      const items = [
        { ...makeCourse("A", "Intro"), cognitiveLoad: { load: 2 } },
        { type: "review_checkpoint", topics: ["A"] },
        { ...makeCourse("B", "Basics"), cognitiveLoad: { load: 3 } },
      ];
      const summary = getLoadSummary(items);
      expect(summary.totalCourses).toBe(2);
    });

    it("categorizes loads into distribution buckets", () => {
      const items = [
        { ...makeCourse("A", "a"), cognitiveLoad: { load: 1 } },
        { ...makeCourse("B", "b"), cognitiveLoad: { load: 3.5 } },
        { ...makeCourse("C", "c"), cognitiveLoad: { load: 7 } },
      ];
      const summary = getLoadSummary(items);
      expect(summary.distribution.low).toBe(1);
      expect(summary.distribution.medium).toBe(1);
      expect(summary.distribution.high).toBe(1);
    });
  });
});
