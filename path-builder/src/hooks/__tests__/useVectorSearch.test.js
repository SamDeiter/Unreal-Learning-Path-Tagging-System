/**
 * useVectorSearch — Unit tests
 *
 * Verifies segment-to-course mapping, score aggregation,
 * error handling, and fallback field support.
 *
 * Uses real timers to avoid fake-timer + async Promise conflicts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useVectorSearch } from "../useVectorSearch";

// Mock pathSearch module
vi.mock("../../services/pathSearch", () => ({
  findRelevantSegments: vi.fn(),
}));

import { findRelevantSegments } from "../../services/pathSearch";

const COURSES = [
  { code: "C001", title: "Blueprint Basics" },
  { code: "C002", title: "Material Fundamentals" },
  { code: "C003", title: "Landscape Sculpting" },
];

describe("useVectorSearch", () => {
  beforeEach(() => {
    findRelevantSegments.mockReset();
  });

  it("returns empty results for short queries", () => {
    const { result } = renderHook(() => useVectorSearch("ab", COURSES));
    expect(result.current.vectorResults).toEqual([]);
    expect(result.current.isSearching).toBe(false);
  });

  it("returns empty results for empty query", () => {
    const { result } = renderHook(() => useVectorSearch("", COURSES));
    expect(result.current.vectorResults).toEqual([]);
  });

  it("fires search and maps segments to courses", async () => {
    findRelevantSegments.mockResolvedValue({
      segments: [
        { courseCode: "C001", similarity: 0.9 },
        { courseCode: "C003", similarity: 0.7 },
      ],
    });

    const { result } = renderHook(() => useVectorSearch("landscape sculpting", COURSES));

    await waitFor(
      () => {
        expect(findRelevantSegments).toHaveBeenCalledWith("landscape sculpting", 15);
      },
      { timeout: 2000 }
    );

    await waitFor(
      () => {
        expect(result.current.vectorResults).toHaveLength(2);
        expect(result.current.vectorResults[0].code).toBe("C001"); // higher similarity
        expect(result.current.vectorResults[1].code).toBe("C003");
        expect(result.current.isSearching).toBe(false);
      },
      { timeout: 2000 }
    );
  });

  it("aggregates scores for duplicate course segments", async () => {
    findRelevantSegments.mockResolvedValue({
      segments: [
        { courseCode: "C002", similarity: 0.5 },
        { courseCode: "C002", similarity: 0.6 },
        { courseCode: "C001", similarity: 0.8 },
      ],
    });

    const { result } = renderHook(() => useVectorSearch("materials", COURSES));

    await waitFor(
      () => {
        // C002 aggregated = 1.1 > C001 = 0.8
        expect(result.current.vectorResults[0].code).toBe("C002");
        expect(result.current.vectorResults[1].code).toBe("C001");
      },
      { timeout: 2000 }
    );
  });

  it("handles search errors gracefully", async () => {
    findRelevantSegments.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useVectorSearch("blueprint tutorial", COURSES));

    await waitFor(
      () => {
        expect(findRelevantSegments).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    await waitFor(
      () => {
        expect(result.current.vectorResults).toEqual([]);
        expect(result.current.isSearching).toBe(false);
      },
      { timeout: 2000 }
    );
  });

  it("filters out segments with unknown course codes", async () => {
    findRelevantSegments.mockResolvedValue({
      segments: [
        { courseCode: "C001", similarity: 0.9 },
        { courseCode: "UNKNOWN", similarity: 0.95 },
      ],
    });

    const { result } = renderHook(() => useVectorSearch("blueprint basics", COURSES));

    await waitFor(
      () => {
        expect(result.current.vectorResults).toHaveLength(1);
        expect(result.current.vectorResults[0].code).toBe("C001");
      },
      { timeout: 2000 }
    );
  });

  it("supports video_code fallback field", async () => {
    findRelevantSegments.mockResolvedValue({
      segments: [{ video_code: "C003", similarity: 0.85 }],
    });

    const { result } = renderHook(() => useVectorSearch("landscape", COURSES));

    await waitFor(
      () => {
        expect(result.current.vectorResults).toHaveLength(1);
        expect(result.current.vectorResults[0].code).toBe("C003");
      },
      { timeout: 2000 }
    );
  });
});
