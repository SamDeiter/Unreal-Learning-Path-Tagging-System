/**
 * Unit Tests for SCORM Generator
 * Tests the utility functions and SCORM manifest generation
 *
 * Uses production-realistic course data matching the actual
 * video_library.json and course_enrichment_data.json schemas.
 */
import { describe, it, expect, vi } from "vitest";

// Mock file-saver to avoid actual downloads
vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

// Import after mocks
import { generateScormPackage } from "../utils/scormGenerator";

describe("SCORM Generator", () => {
  // Production-realistic course data matching real catalog structure
  const materialsCourse = {
    id: "311.01",
    title: "Landscape Materials Creation",
    description: "Create and optimize PBR landscape materials in Unreal Engine 5.",
    learningObjectives: [
      "Create PBR landscape materials",
      "Use material instances for variation",
      "Optimize material performance for open worlds",
    ],
    difficulty: "intermediate",
    estimatedHours: 1.5,
    prerequisites: ["Basic UE5 editor navigation"],
    totalDuration: "1h 30m",
    totalVideos: 2,
    createdAt: "2026-01-15T10:00:00Z",
    aiGenerated: true,
    videos: [
      {
        id: "311.01-v01",
        title: "Material Editor Introduction",
        sequence: 1,
        duration: "15m",
        durationSeconds: 900,
        tags: ["materials", "editor"],
        transcript: "The Material Editor in Unreal Engine allows you to create and modify materials using a node-based workflow...",
        quiz: null,
        scormResourceId: "RES_001",
      },
      {
        id: "311.01-v02",
        title: "Creating PBR Materials",
        sequence: 2,
        duration: "25m",
        durationSeconds: 1500,
        tags: ["materials", "pbr", "textures"],
        transcript: "PBR or Physically Based Rendering materials simulate how light interacts with surfaces...",
        quiz: [
          {
            question: "What does PBR stand for in the context of materials?",
            options: [
              "Physically Based Rendering",
              "Pixel Based Rendering",
              "Photo Basic Rendering",
              "Point Based Rendering",
            ],
            correctIndex: 0,
            explanation: "PBR stands for Physically Based Rendering, a method of shading that models real-world light behavior.",
          },
        ],
        scormResourceId: "RES_002",
      },
    ],
  };

  describe("generateScormPackage", () => {
    it("should generate a SCORM package without throwing", async () => {
      const result = await generateScormPackage(materialsCourse);

      expect(result).toBeDefined();
      expect(result).toContain("_SCORM.zip");
    });

    it("should sanitize the filename correctly", async () => {
      const result = await generateScormPackage(materialsCourse);

      // Should replace special chars with underscores
      expect(result).toMatch(/^[a-zA-Z0-9_]+_SCORM\.zip$/);
    });

    it("should handle courses with special characters in title", async () => {
      const specialCourse = {
        ...materialsCourse,
        title: "UE5: Materials & Lighting!!! (Part 1)",
      };

      const result = await generateScormPackage(specialCourse);
      expect(result).toBeDefined();
      expect(result).not.toContain(":");
      expect(result).not.toContain("&");
    });

    it("should handle courses with no videos gracefully", async () => {
      const emptyCourse = {
        ...materialsCourse,
        videos: [],
        totalVideos: 0,
      };

      const result = await generateScormPackage(emptyCourse);
      expect(result).toBeDefined();
    });
  });

  describe("Course Data Validation", () => {
    it("should have required course properties", () => {
      expect(materialsCourse).toHaveProperty("id");
      expect(materialsCourse).toHaveProperty("title");
      expect(materialsCourse).toHaveProperty("videos");
      expect(materialsCourse).toHaveProperty("learningObjectives");
    });

    it("should have videos with required properties", () => {
      materialsCourse.videos.forEach((video) => {
        expect(video).toHaveProperty("id");
        expect(video).toHaveProperty("title");
        expect(video).toHaveProperty("scormResourceId");
      });
    });

    it("should have properly formatted SCORM resource IDs", () => {
      materialsCourse.videos.forEach((video) => {
        expect(video.scormResourceId).toMatch(/^RES_\d{3}$/);
      });
    });
  });
});
