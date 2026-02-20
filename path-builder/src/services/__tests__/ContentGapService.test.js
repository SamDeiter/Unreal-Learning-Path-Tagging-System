/**
 * Unit tests for ContentGapService
 */
import { describe, it, expect } from "vitest";
import { getRelevanceBadge, analyzeGaps } from "../ContentGapService";

// ── Mock course objects ──────────────────────────────────────────────────
const animCourse = {
  code: "200.01",
  title: "Getting Started with Sequencer",
  canonical_tags: ["sequencer", "cinematics"],
  ai_tags: ["animation"],
  gemini_system_tags: [],
  transcript_tags: [],
  extracted_tags: [],
};

const cppCourse = {
  code: "300.01",
  title: "C++ Gameplay Programming Fundamentals",
  canonical_tags: ["c++", "programming"],
  ai_tags: ["code"],
  gemini_system_tags: [],
  transcript_tags: ["blueprint"],
  extracted_tags: [],
};

const neutralCourse = {
  code: "100.01",
  title: "UE5 Editor Overview",
  canonical_tags: ["editor"],
  ai_tags: [],
  gemini_system_tags: [],
  transcript_tags: [],
  extracted_tags: [],
};

// ── getRelevanceBadge ────────────────────────────────────────────────────
describe("getRelevanceBadge", () => {
  it("returns 'relevant' badge for persona-matching courses", () => {
    const badge = getRelevanceBadge(animCourse, "animator_alex");
    expect(badge.type).toBe("relevant");
    expect(badge.score).toBeGreaterThan(0);
    expect(badge.label).toBeTruthy();
  });

  it("returns a valid badge type (relevant, technical, or neutral)", () => {
    const badge = getRelevanceBadge(cppCourse, "animator_alex");
    expect(["relevant", "technical", "neutral"]).toContain(badge.type);
    expect(typeof badge.score).toBe("number");
  });

  it("returns neutral/empty for unrelated courses", () => {
    const badge = getRelevanceBadge(neutralCourse, "animator_alex");
    expect(badge.type).toBe("neutral");
    expect(badge.label).toBe("");
  });

  it("returns neutral when persona ID is invalid", () => {
    const badge = getRelevanceBadge(animCourse, "nonexistent_persona");
    expect(badge.type).toBe("neutral");
    expect(badge.score).toBe(0);
  });
});

// ── analyzeGaps ──────────────────────────────────────────────────────────
describe("analyzeGaps", () => {
  const courses = [animCourse, cppCourse, neutralCourse];

  it("returns empty results for invalid persona", () => {
    const result = analyzeGaps("invalid_id", courses, []);
    expect(result.coveredTopics).toHaveLength(0);
    expect(result.missingTopics).toHaveLength(0);
    expect(result.relevanceScores).toHaveLength(0);
  });

  it("returns structured results for valid persona", () => {
    const result = analyzeGaps("animator_alex", courses, []);
    expect(result).toHaveProperty("coveredTopics");
    expect(result).toHaveProperty("missingTopics");
    expect(result).toHaveProperty("artistFriendly");
    expect(result).toHaveProperty("tooTechnical");
    expect(result).toHaveProperty("totalCourses", courses.length);
  });

  it("identifies artist-friendly courses for animator persona", () => {
    const result = analyzeGaps("animator_alex", courses, []);
    // Sequencer/animation course should be artist-friendly
    const friendlyCodes = result.artistFriendly.map((c) => c.code);
    expect(friendlyCodes).toContain("200.01");
  });

  it("tooTechnical courses have negative scores and penalty matches", () => {
    const result = analyzeGaps("animator_alex", courses, []);
    // All tooTechnical entries should have negative score and isTechnical=true
    result.tooTechnical.forEach((c) => {
      expect(c.isTechnical).toBe(true);
      expect(c.score).toBeLessThan(0);
    });
  });
});
