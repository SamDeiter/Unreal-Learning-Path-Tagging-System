/**
 * useGuidedPlayer — Reading Step Tests
 * Tests that reading steps (doc/YouTube items) skip quiz/challenge and advance correctly.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock all service dependencies before importing the hook
vi.mock("../services/narratorService", () => ({
  generatePathIntro: vi.fn(() => ({ title: "Test Path", body: "Test body" })),
  generateBridgeText: vi.fn(() => "Bridge text"),
  generateProgressText: vi.fn(() => "1/3 done"),
}));

vi.mock("../services/challengeService", () => ({
  generateChallenge: vi.fn(() => Promise.resolve({
    title: "Test Challenge",
    instructions: "Do this",
    whatToLookFor: "Check that",
    hint: "Try this",
  })),
}));

vi.mock("../services/googleAuthService", () => ({
  signInWithGoogle: vi.fn(() => Promise.resolve({ error: null })),
  onAuthChange: vi.fn((cb) => { cb({ uid: "test-user" }); return () => {}; }),
}));

vi.mock("../services/learningProgressService", () => ({
  recordPathCompletion: vi.fn(() => Promise.resolve()),
  getStreakInfo: vi.fn(() => ({ currentStreak: 0, longestStreak: 0, totalPaths: 0 })),
}));

vi.mock("../data/quiz_questions.json", () => ({ default: {} }));

import useGuidedPlayer, { STAGES } from "../hooks/useGuidedPlayer";

describe("useGuidedPlayer — Reading Steps", () => {
  const videoCourse = {
    code: "100_01",
    title: "Lumen Setup",
    videos: [{ drive_id: "abc", title: "Lumen Intro" }],
  };

  const readingStepDoc = {
    _readingStep: true,
    _resourceType: "doc",
    _url: "https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen",
    title: "Lumen Documentation",
    code: "doc_lumen",
    videos: [],
  };

  const readingStepYT = {
    _readingStep: true,
    _resourceType: "youtube",
    _url: "https://youtube.com/watch?v=xyz",
    title: "Lumen Deep Dive",
    code: "yt_lumen",
    videos: [],
  };

  const defaultProps = {
    courses: [videoCourse, readingStepDoc, readingStepYT],
    diagnosis: { problem_summary: "test" },
    problemSummary: "test problem",
    pathSummary: null,
    onComplete: vi.fn(),
    onExit: vi.fn(),
  };

  it("exports STAGES constant with all required stages", () => {
    expect(STAGES).toBeDefined();
    expect(STAGES.INTRO).toBe("intro");
    expect(STAGES.PLAYING).toBe("playing");
    expect(STAGES.QUIZ).toBe("quiz");
    expect(STAGES.CHALLENGE).toBe("challenge");
    expect(STAGES.COMPLETE).toBe("complete");
  });

  it("starts at intro stage with first course", () => {
    const { result } = renderHook(() => useGuidedPlayer(defaultProps));
    expect(result.current.stage).toBe(STAGES.INTRO);
    expect(result.current.currentCourse?.code).toBe("100_01");
  });

  it("identifies reading step courses via _readingStep flag", () => {
    const courses = defaultProps.courses;
    expect(courses[0]._readingStep).toBeUndefined();
    expect(courses[1]._readingStep).toBe(true);
    expect(courses[1]._resourceType).toBe("doc");
    expect(courses[2]._readingStep).toBe(true);
    expect(courses[2]._resourceType).toBe("youtube");
  });

  it("handleVideoComplete skips quiz/challenge for reading steps", () => {
    const readingOnlyCourses = [readingStepDoc, readingStepYT];
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useGuidedPlayer({
        ...defaultProps,
        courses: readingOnlyCourses,
        onComplete,
      })
    );

    // Start playing
    act(() => result.current.handleStartLearning());
    expect(result.current.stage).toBe(STAGES.PLAYING);
    expect(result.current.currentCourse?.code).toBe("doc_lumen");

    // Complete reading step — should skip quiz/challenge, advance to next
    act(() => result.current.handleVideoComplete());
    expect(result.current.currentCourse?.code).toBe("yt_lumen");
    // Should still be in PLAYING stage (not quiz or challenge)
    expect(result.current.stage).toBe(STAGES.PLAYING);
  });

  it("completes path after last reading step", () => {
    const singleReading = [readingStepDoc];
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useGuidedPlayer({
        ...defaultProps,
        courses: singleReading,
        onComplete,
      })
    );

    // Start and complete the single reading step
    act(() => result.current.handleStartLearning());
    act(() => result.current.handleVideoComplete());

    expect(result.current.stage).toBe(STAGES.COMPLETE);
  });
});
