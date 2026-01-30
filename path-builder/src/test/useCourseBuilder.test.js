/**
 * Unit Tests for useCourseBuilder Hook
 * Tests the course building workflow logic
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCourseBuilder } from "../hooks/useCourseBuilder";

// Mock the geminiService
vi.mock("../services/geminiService", () => ({
  generateCourseMetadata: vi.fn(),
  generateQuizQuestions: vi.fn(),
  isGeminiConfigured: vi.fn(() => true),
}));

// Mock the scormGenerator
vi.mock("../utils/scormGenerator", () => ({
  generateScormPackage: vi.fn(() => Promise.resolve("test_SCORM.zip")),
}));

import { generateCourseMetadata, generateQuizQuestions } from "../services/geminiService";

describe("useCourseBuilder Hook", () => {
  // Sample test data
  const mockVideos = [
    {
      id: "video-1",
      title: "Introduction to Materials",
      duration_seconds: 600,
      duration_formatted: "10m",
      tags: ["materials", "basics"],
      transcript: "This is the intro transcript...",
    },
    {
      id: "video-2",
      title: "PBR Materials",
      duration_seconds: 900,
      duration_formatted: "15m",
      tags: ["materials", "pbr"],
      transcript: "PBR materials are...",
    },
  ];

  const mockMetadata = {
    title: "UE5 Materials Course",
    description: "Learn materials in UE5",
    learningObjectives: ["Create PBR materials", "Optimize performance"],
    suggestedOrder: [1, 2],
    difficulty: "intermediate",
    estimatedHours: 1,
    prerequisites: ["Basic UE5 knowledge"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    generateCourseMetadata.mockResolvedValue(mockMetadata);
    generateQuizQuestions.mockResolvedValue([
      {
        question: "Test question?",
        options: ["A", "B", "C", "D"],
        correctIndex: 0,
        explanation: "Correct answer is A",
      },
    ]);
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      const { result } = renderHook(() => useCourseBuilder());

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.generatedCourse).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toEqual({ step: "", percent: 0 });
    });

    it("should expose required methods", () => {
      const { result } = renderHook(() => useCourseBuilder());

      expect(typeof result.current.generateCourse).toBe("function");
      expect(typeof result.current.downloadScormPackage).toBe("function");
      expect(typeof result.current.reset).toBe("function");
    });
  });

  describe("generateCourse", () => {
    it("should set error when no videos selected", async () => {
      const { result } = renderHook(() => useCourseBuilder());

      await act(async () => {
        await result.current.generateCourse([]);
      });

      expect(result.current.error).toBe("No videos selected");
    });

    it("should call generateCourseMetadata with videos", async () => {
      const { result } = renderHook(() => useCourseBuilder());

      await act(async () => {
        await result.current.generateCourse(mockVideos, { includeQuizzes: false });
      });

      expect(generateCourseMetadata).toHaveBeenCalledWith(mockVideos);
    });

    it("should generate course object with correct structure", async () => {
      const { result } = renderHook(() => useCourseBuilder());

      await act(async () => {
        await result.current.generateCourse(mockVideos, { includeQuizzes: false });
      });

      await waitFor(() => {
        expect(result.current.generatedCourse).not.toBeNull();
      });

      const course = result.current.generatedCourse;
      expect(course).toHaveProperty("id");
      expect(course).toHaveProperty("title", mockMetadata.title);
      expect(course).toHaveProperty("description", mockMetadata.description);
      expect(course).toHaveProperty("videos");
      expect(course.videos).toHaveLength(2);
    });

    it("should update progress during generation", async () => {
      const { result } = renderHook(() => useCourseBuilder());

      // Can't easily test intermediate states, but can verify final state
      await act(async () => {
        await result.current.generateCourse(mockVideos);
      });

      await waitFor(() => {
        expect(result.current.progress.percent).toBe(100);
      });
    });
  });

  describe("reset", () => {
    it("should reset all state values", async () => {
      const { result } = renderHook(() => useCourseBuilder());

      // Generate a course first
      await act(async () => {
        await result.current.generateCourse(mockVideos);
      });

      // Then reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.generatedCourse).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.progress).toEqual({ step: "", percent: 0 });
    });
  });
});
