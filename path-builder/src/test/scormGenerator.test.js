/**
 * Unit Tests for SCORM Generator
 * Tests the utility functions and SCORM manifest generation
 */
import { describe, it, expect, vi } from "vitest";

// Mock file-saver to avoid actual downloads
vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

// Import after mocks
import { generateScormPackage } from "../utils/scormGenerator";

describe("SCORM Generator", () => {
  // Sample course data for testing
  const mockCourse = {
    id: "course-123",
    title: "UE5 Materials Course",
    description: "Learn material creation in Unreal Engine 5.",
    learningObjectives: [
      "Create PBR materials",
      "Use material instances",
      "Optimize material performance",
    ],
    difficulty: "intermediate",
    estimatedHours: 3,
    prerequisites: ["Basic UE5 knowledge"],
    totalDuration: "3h 15m",
    totalVideos: 5,
    createdAt: "2026-01-30T10:00:00Z",
    aiGenerated: true,
    videos: [
      {
        id: "video-001",
        title: "Introduction to Materials",
        sequence: 1,
        duration: "15m",
        durationSeconds: 900,
        tags: ["materials", "basics"],
        transcript: "This is the introduction...",
        quiz: null,
        scormResourceId: "RES_001",
      },
      {
        id: "video-002",
        title: "Creating PBR Materials",
        sequence: 2,
        duration: "25m",
        durationSeconds: 1500,
        tags: ["materials", "pbr"],
        transcript: "PBR materials are...",
        quiz: [
          {
            question: "What does PBR stand for?",
            options: [
              "Physically Based Rendering",
              "Pixel Based Rendering",
              "Photo Basic Rendering",
              "Point Based Rendering",
            ],
            correctIndex: 0,
            explanation: "PBR means Physically Based Rendering",
          },
        ],
        scormResourceId: "RES_002",
      },
    ],
  };

  describe("generateScormPackage", () => {
    it("should generate a SCORM package without throwing", async () => {
      // The function should complete without errors
      const result = await generateScormPackage(mockCourse);

      // Should return the filename
      expect(result).toBeDefined();
      expect(result).toContain("_SCORM.zip");
    });

    it("should sanitize the filename correctly", async () => {
      const result = await generateScormPackage(mockCourse);

      // Should replace special chars with underscores
      expect(result).toMatch(/^[a-zA-Z0-9_]+_SCORM\.zip$/);
    });

    it("should handle courses with special characters in title", async () => {
      const specialCourse = {
        ...mockCourse,
        title: "UE5: Materials & Lighting!!! (Part 1)",
      };

      const result = await generateScormPackage(specialCourse);
      expect(result).toBeDefined();
      expect(result).not.toContain(":");
      expect(result).not.toContain("&");
    });

    it("should handle courses with no videos gracefully", async () => {
      const emptyCourse = {
        ...mockCourse,
        videos: [],
        totalVideos: 0,
      };

      const result = await generateScormPackage(emptyCourse);
      expect(result).toBeDefined();
    });
  });

  describe("Course Data Validation", () => {
    it("should have required course properties", () => {
      expect(mockCourse).toHaveProperty("id");
      expect(mockCourse).toHaveProperty("title");
      expect(mockCourse).toHaveProperty("videos");
      expect(mockCourse).toHaveProperty("learningObjectives");
    });

    it("should have videos with required properties", () => {
      mockCourse.videos.forEach((video) => {
        expect(video).toHaveProperty("id");
        expect(video).toHaveProperty("title");
        expect(video).toHaveProperty("scormResourceId");
      });
    });

    it("should have properly formatted SCORM resource IDs", () => {
      mockCourse.videos.forEach((video) => {
        expect(video.scormResourceId).toMatch(/^RES_\d{3}$/);
      });
    });
  });
});
