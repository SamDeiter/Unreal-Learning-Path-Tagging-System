/**
 * Course Builder Hook
 * Manages the workflow for generating SCORM-compatible courses from selected videos
 */
import { useState, useCallback } from "react";
import {
  generateCourseMetadata,
  generateQuizQuestions,
  isGeminiConfigured,
} from "../services/geminiService";
import { generateScormPackage } from "../utils/scormGenerator";

/**
 * Custom hook for course building workflow
 * @returns {Object} Course builder state and methods
 */
export function useCourseBuilder() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ step: "", percent: 0 });
  const [generatedCourse, setGeneratedCourse] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Generate a complete course from selected videos
   * @param {Array} selectedVideos - Videos to include in course
   * @param {Object} options - Generation options
   */
  const generateCourse = useCallback(async (selectedVideos, options = {}) => {
    if (!selectedVideos || selectedVideos.length === 0) {
      setError("No videos selected");
      return null;
    }

    setIsGenerating(true);
    setError(null);
    setProgress({ step: "Analyzing video content...", percent: 10 });

    try {
      // Step 1: Generate course metadata with Gemini
      setProgress({ step: "Generating course metadata with AI...", percent: 30 });
      const metadata = await generateCourseMetadata(selectedVideos);

      // Step 2: Reorder videos based on AI suggestion
      setProgress({ step: "Optimizing video sequence...", percent: 50 });
      const orderedVideos = reorderVideos(selectedVideos, metadata.suggestedOrder);

      // Step 3: Generate quizzes if requested
      let quizzes = {};
      if (options.includeQuizzes) {
        setProgress({ step: "Generating quiz questions...", percent: 60 });
        for (let i = 0; i < orderedVideos.length; i++) {
          const video = orderedVideos[i];
          if (video.transcript) {
            quizzes[video.id || video.code] = await generateQuizQuestions(video, 3);
          }
        }
      }

      // Step 4: Build course object
      setProgress({ step: "Building course structure...", percent: 80 });
      const course = {
        id: `course-${Date.now()}`,
        title: metadata.title,
        description: metadata.description,
        learningObjectives: metadata.learningObjectives,
        difficulty: metadata.difficulty,
        estimatedHours: metadata.estimatedHours,
        prerequisites: metadata.prerequisites,
        videos: orderedVideos.map((video, index) => ({
          id: video.id || video.code,
          title: video.title || video.name,
          sequence: index + 1,
          duration: video.duration_formatted || formatDuration(video.duration_seconds),
          durationSeconds: video.duration_seconds || 0,
          tags: video.tags || video.extracted_tags || [],
          transcript: video.transcript || "",
          quiz: quizzes[video.id || video.code] || null,
          scormResourceId: `RES_${String(index + 1).padStart(3, "0")}`,
        })),
        totalDuration: formatDuration(
          orderedVideos.reduce((sum, v) => sum + (v.duration_seconds || 0), 0)
        ),
        totalVideos: orderedVideos.length,
        createdAt: new Date().toISOString(),
        aiGenerated: isGeminiConfigured(),
      };

      setProgress({ step: "Course ready!", percent: 100 });
      setGeneratedCourse(course);
      return course;
    } catch (err) {
      console.error("Course generation error:", err);
      setError(err.message || "Failed to generate course");
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  /**
   * Download the generated course as a SCORM package
   */
  const downloadScormPackage = useCallback(async () => {
    if (!generatedCourse) {
      setError("No course to download");
      return;
    }

    setIsGenerating(true);
    setProgress({ step: "Packaging SCORM content...", percent: 50 });

    try {
      await generateScormPackage(generatedCourse);
      setProgress({ step: "Download complete!", percent: 100 });
    } catch (err) {
      console.error("SCORM package error:", err);
      setError(err.message || "Failed to create SCORM package");
    } finally {
      setIsGenerating(false);
    }
  }, [generatedCourse]);

  /**
   * Reset the course builder state
   */
  const reset = useCallback(() => {
    setGeneratedCourse(null);
    setError(null);
    setProgress({ step: "", percent: 0 });
  }, []);

  return {
    // State
    isGenerating,
    progress,
    generatedCourse,
    error,
    isGeminiConfigured: isGeminiConfigured(),

    // Actions
    generateCourse,
    downloadScormPackage,
    reset,
  };
}

/**
 * Reorder videos based on AI-suggested order
 */
function reorderVideos(videos, suggestedOrder) {
  if (!suggestedOrder || suggestedOrder.length !== videos.length) {
    return [...videos];
  }

  return suggestedOrder.map((index) => videos[index - 1]).filter(Boolean);
}

/**
 * Format seconds to readable duration
 */
function formatDuration(seconds) {
  if (!seconds) return "0m";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export default useCourseBuilder;
