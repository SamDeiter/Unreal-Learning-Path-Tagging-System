/**
 * prerequisiteGraph — Unit tests
 *
 * Tests graph construction, cycle detection, topological sort,
 * and depth calculation.
 */

import { describe, it, expect } from "vitest";
import {
  buildPrerequisiteGraph,
  detectCycles,
  topologicalSort,
  calculateDepths,
} from "../../services/prerequisiteGraph";

const makeCourse = (code, prereqs = [], tagPrereqs = "") => ({
  code,
  title: `Course ${code}`,
  gemini_enriched: { prerequisites: prereqs },
  tags: { prerequisites: tagPrereqs },
});

describe("prerequisiteGraph", () => {
  describe("buildPrerequisiteGraph", () => {
    it("builds graph from gemini_enriched prerequisites", () => {
      const courses = [makeCourse("A"), makeCourse("B", ["A"]), makeCourse("C", ["A", "B"])];
      const graph = buildPrerequisiteGraph(courses);
      expect(graph.get("A").size).toBe(0);
      expect(graph.get("B").has("A")).toBe(true);
      expect(graph.get("C").has("A")).toBe(true);
      expect(graph.get("C").has("B")).toBe(true);
    });

    it("builds graph from tag-based prerequisites", () => {
      const courses = [makeCourse("X"), makeCourse("Y", [], "X"), makeCourse("Z", [], "X, Y")];
      const graph = buildPrerequisiteGraph(courses);
      expect(graph.get("Y").has("X")).toBe(true);
      expect(graph.get("Z").has("X")).toBe(true);
      expect(graph.get("Z").has("Y")).toBe(true);
    });

    it("ignores self-references", () => {
      const courses = [makeCourse("A", ["A"])];
      const graph = buildPrerequisiteGraph(courses);
      expect(graph.get("A").size).toBe(0);
    });

    it("ignores unknown prerequisite codes", () => {
      const courses = [makeCourse("A", ["UNKNOWN"])];
      const graph = buildPrerequisiteGraph(courses);
      expect(graph.get("A").size).toBe(0);
    });
  });

  describe("detectCycles", () => {
    it("detects no cycle in a DAG", () => {
      const courses = [makeCourse("A"), makeCourse("B", ["A"]), makeCourse("C", ["B"])];
      const graph = buildPrerequisiteGraph(courses);
      const result = detectCycles(graph);
      expect(result.hasCycle).toBe(false);
      expect(result.cycleNodes).toEqual([]);
    });

    it("detects a cycle", () => {
      const courses = [makeCourse("A", ["C"]), makeCourse("B", ["A"]), makeCourse("C", ["B"])];
      const graph = buildPrerequisiteGraph(courses);
      const result = detectCycles(graph);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodes.length).toBeGreaterThan(0);
    });
  });

  describe("topologicalSort", () => {
    it("sorts courses in prerequisite-first order", () => {
      const courses = [makeCourse("C", ["B"]), makeCourse("A"), makeCourse("B", ["A"])];
      const sorted = topologicalSort(courses);
      const codes = sorted.map((c) => c.code);
      expect(codes.indexOf("A")).toBeLessThan(codes.indexOf("B"));
      expect(codes.indexOf("B")).toBeLessThan(codes.indexOf("C"));
    });

    it("handles single course", () => {
      const courses = [makeCourse("A")];
      const sorted = topologicalSort(courses);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].code).toBe("A");
    });

    it("handles courses with no prerequisites", () => {
      const courses = [makeCourse("X"), makeCourse("Y"), makeCourse("Z")];
      const sorted = topologicalSort(courses);
      expect(sorted).toHaveLength(3);
    });

    it("handles cyclic dependencies gracefully", () => {
      const courses = [makeCourse("A", ["C"]), makeCourse("B", ["A"]), makeCourse("C", ["B"])];
      // Should not throw; appends cyclic nodes
      const sorted = topologicalSort(courses);
      expect(sorted).toHaveLength(3);
    });
  });

  describe("calculateDepths", () => {
    it("calculates depth 0 for courses with no prerequisites", () => {
      const courses = [makeCourse("A"), makeCourse("B")];
      const graph = buildPrerequisiteGraph(courses);
      const depths = calculateDepths(graph);
      expect(depths.get("A")).toBe(0);
      expect(depths.get("B")).toBe(0);
    });

    it("calculates correct chain depth", () => {
      const courses = [makeCourse("A"), makeCourse("B", ["A"]), makeCourse("C", ["B"])];
      const graph = buildPrerequisiteGraph(courses);
      const depths = calculateDepths(graph);
      expect(depths.get("A")).toBe(0);
      expect(depths.get("B")).toBe(1);
      expect(depths.get("C")).toBe(2);
    });

    it("handles diamond dependencies", () => {
      const courses = [
        makeCourse("A"),
        makeCourse("B", ["A"]),
        makeCourse("C", ["A"]),
        makeCourse("D", ["B", "C"]),
      ];
      const graph = buildPrerequisiteGraph(courses);
      const depths = calculateDepths(graph);
      expect(depths.get("D")).toBe(2);
    });
  });
});
