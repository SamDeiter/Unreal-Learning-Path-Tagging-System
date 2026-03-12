/**
 * roadmapService.test.js — Tests for frontend roadmap orchestration
 */

import { describe, it, expect } from "vitest";
import { isGoalBuildQuery } from "../../services/roadmapService";

describe("roadmapService", () => {
  // ── Goal-build query detection ──────────────────────────────────────

  describe("isGoalBuildQuery", () => {
    it("detects beginner goal queries", () => {
      expect(isGoalBuildQuery("I'm new to UE5 and want to make a game")).toBe(true);
    });

    it('detects "from scratch" queries', () => {
      expect(isGoalBuildQuery("I want to learn Unreal from scratch")).toBe(true);
    });

    it('detects "first game" queries', () => {
      expect(isGoalBuildQuery("Help me make my first game")).toBe(true);
    });

    it('detects "getting started" queries', () => {
      expect(isGoalBuildQuery("Getting started with UE5")).toBe(true);
    });

    it('detects "teach me" queries', () => {
      expect(isGoalBuildQuery("Teach me Unreal Engine")).toBe(true);
    });

    it('detects "roadmap" queries', () => {
      expect(isGoalBuildQuery("Give me a roadmap for game dev")).toBe(true);
    });

    it('detects "complete beginner" queries', () => {
      expect(isGoalBuildQuery("I'm a complete beginner")).toBe(true);
    });

    it("returns false for problem queries", () => {
      expect(isGoalBuildQuery("My Blueprint has an error")).toBe(false);
    });

    it("returns false for mixed goal + problem queries", () => {
      expect(isGoalBuildQuery("I'm a beginner and I have a crash")).toBe(false);
    });

    it("returns false for regular technical queries", () => {
      expect(isGoalBuildQuery("How to set up landscape material layers")).toBe(false);
    });

    it("returns false for null/undefined/empty", () => {
      expect(isGoalBuildQuery(null)).toBe(false);
      expect(isGoalBuildQuery(undefined)).toBe(false);
      expect(isGoalBuildQuery("")).toBe(false);
    });
  });
});
