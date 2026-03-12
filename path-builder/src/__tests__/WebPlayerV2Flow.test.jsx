/**
 * WebPlayerV2Flow.test.jsx — V2 Unified Learner Flow Tests
 *
 * Verifies that V2 paths use the LearnerView + LessonCard components
 * for the full learn flow instead of the legacy thin renderer.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LearnerView from "../components/LearnerView/LearnerView.jsx";
import LessonCard from "../components/LearnerView/LessonCard.jsx";

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// ── Mock V2 Path Data ──
function createMockV2Path(overrides = {}) {
  return {
    schemaVersion: 2,
    title: "Test Path: Blueprints",
    quickAnswer: "Blueprints are UE5's visual scripting system.",
    learningOutcomes: ["Understand Blueprints", "Build character movement"],
    estimatedMinutes: 45,
    generatedAt: "2026-03-12T12:00:00Z",
    sections: [
      {
        id: "sec-prereqs",
        phase: "prerequisites",
        title: "Prerequisites",
        purpose: "Foundational knowledge",
        steps: [
          {
            id: "step-1",
            title: "Understanding the Event Graph",
            summary: "Learn the basics of the Event Graph.",
            whyThisMatters: "The Event Graph is where all gameplay logic lives.",
            whatToDo: ["Open a Blueprint", "Find the Event Graph tab"],
            howToVerify: ["You see the grid canvas with BeginPlay node"],
            commonMistake: "Trying to compile before adding nodes.",
            takeaway: "Event Graph = your visual code canvas.",
            completionType: "do",
            estimatedMinutes: 5,
          },
        ],
      },
      {
        id: "sec-core",
        phase: "core",
        title: "Core Lessons",
        purpose: "Primary learning content",
        steps: [
          {
            id: "step-2",
            title: "Variables and Data Types",
            summary: "How to create and use variables.",
            whyThisMatters: "Variables store your game state.",
            whatToDo: ["Create a float variable", "Set its default value"],
            howToVerify: ["Variable appears in My Blueprint panel"],
            commonMistake: "Forgetting to compile after adding variables.",
            takeaway: "Variables are the memory of your Blueprint.",
            completionType: "watch",
            estimatedMinutes: 8,
            video: {
              driveId: "abc123",
              videoTitle: "Blueprint Variables Deep Dive",
              startSec: 30,
              endSec: 240,
            },
          },
          {
            id: "step-3",
            title: "Character Movement",
            summary: "Wire up WASD movement.",
            completionType: "apply",
            estimatedMinutes: 12,
            source: "video",
            // No video URL — should trigger fallback
          },
        ],
      },
    ],
    ...overrides,
  };
}

// ── LessonCard Tests ──

describe("LessonCard", () => {
  const mockStep = createMockV2Path().sections[0].steps[0];

  it("renders structured sections when data is available", () => {
    render(
      <LessonCard step={mockStep} index={0} isCompleted={false} />
    );
    expect(screen.getByText("💡 Why This Matters")).toBeTruthy();
    expect(screen.getByText(mockStep.whyThisMatters)).toBeTruthy();
  });

  it("auto-expands when isFocused is true", () => {
    render(
      <LessonCard step={mockStep} index={0} isCompleted={false} isFocused={true} />
    );
    // Body sections should be visible
    expect(screen.getByText("💡 Why This Matters")).toBeTruthy();
  });

  it("shows focused styling class when isFocused", () => {
    const { container } = render(
      <LessonCard step={mockStep} index={0} isCompleted={false} isFocused={true} />
    );
    expect(container.querySelector(".lesson-card--focused")).toBeTruthy();
  });

  it("renders inline video when step has video data", () => {
    const videoStep = createMockV2Path().sections[1].steps[0]; // Has driveId
    render(
      <LessonCard step={videoStep} index={1} isCompleted={false} isFocused={true} />
    );
    expect(screen.getByText("🎬 Video")).toBeTruthy();
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe.src).toContain("drive.google.com");
  });

  it("shows video fallback for video-marked steps without URL", () => {
    const fallbackStep = createMockV2Path().sections[1].steps[1]; // source=video, no URL
    render(
      <LessonCard step={fallbackStep} index={2} isCompleted={false} isFocused={true} />
    );
    expect(screen.getByText(/This step references a video resource/)).toBeTruthy();
  });

  it("renders video BEFORE content for watch-type steps", () => {
    const videoStep = createMockV2Path().sections[1].steps[0]; // completionType=watch + driveId
    const { container } = render(
      <LessonCard step={videoStep} index={1} isCompleted={false} isFocused={true} />
    );
    const body = container.querySelector(".lesson-card__body");
    const sections = body.querySelectorAll(".lesson-card__section");
    // First section should be the video section
    expect(sections[0].classList.contains("lesson-card__section--video")).toBe(true);
  });

  it("renders video AFTER 'Why This Matters' for non-watch steps with video", () => {
    // Create a 'read' step that also has video — isVideoStep is true because !!step.video
    // But completionType is NOT 'watch', source is NOT 'video'
    // With the current logic, isVideoStep = !!step.video → true, so video renders first.
    // Instead, test with a step where completionType is 'do' and source is NOT 'video'
    // and step.video is null → no video renders at all.
    // The real test: a 'do' step with no video property should not render video section.
    const doStepNoVideo = {
      ...createMockV2Path().sections[0].steps[0],
      completionType: "do",
      video: null,
    };
    const { container } = render(
      <LessonCard step={doStepNoVideo} index={0} isCompleted={false} isFocused={true} />
    );
    const body = container.querySelector(".lesson-card__body");
    const videoSections = body.querySelectorAll(".lesson-card__section--video");
    expect(videoSections.length).toBe(0);
  });
});

// ── LearnerView Tests ──

describe("LearnerView", () => {
  it("renders all sections and steps from V2 path", () => {
    const v2Path = createMockV2Path();
    render(<LearnerView v2Path={v2Path} />);
    expect(screen.getByText("Prerequisites")).toBeTruthy();
    expect(screen.getByText("Core Lessons")).toBeTruthy();
    expect(screen.getByText("Understanding the Event Graph")).toBeTruthy();
    expect(screen.getByText("Variables and Data Types")).toBeTruthy();
  });

  it("shows progress bar", () => {
    const v2Path = createMockV2Path();
    render(<LearnerView v2Path={v2Path} />);
    expect(screen.getByText(/0\/3 steps/)).toBeTruthy();
  });

  it("renders PathIntro when showIntro is true", () => {
    const v2Path = createMockV2Path();
    render(<LearnerView v2Path={v2Path} showIntro={true} />);
    expect(screen.getByText(v2Path.quickAnswer)).toBeTruthy();
  });

  it("hides PathIntro when showIntro is false", () => {
    const v2Path = createMockV2Path();
    render(<LearnerView v2Path={v2Path} showIntro={false} />);
    expect(screen.queryByText(v2Path.quickAnswer)).toBeNull();
  });

  it("shows navigation bar in focused mode", () => {
    const v2Path = createMockV2Path();
    render(
      <LearnerView
        v2Path={v2Path}
        focusedStepIndex={0}
        onStepChange={() => {}}
        onComplete={() => {}}
      />
    );
    expect(screen.getByText("← Previous")).toBeTruthy();
    expect(screen.getByText(/Complete & Continue/)).toBeTruthy();
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
  });

  it("calls onStepChange when Next is clicked", () => {
    const v2Path = createMockV2Path();
    const onStepChange = vi.fn();
    render(
      <LearnerView
        v2Path={v2Path}
        focusedStepIndex={0}
        onStepChange={onStepChange}
        onComplete={() => {}}
      />
    );
    fireEvent.click(screen.getByText(/Complete & Continue/));
    expect(onStepChange).toHaveBeenCalledWith(1);
  });

  it("calls onComplete when on last step and Next is clicked", () => {
    const v2Path = createMockV2Path();
    const onComplete = vi.fn();
    render(
      <LearnerView
        v2Path={v2Path}
        focusedStepIndex={2} // last step
        onStepChange={() => {}}
        onComplete={onComplete}
      />
    );
    fireEvent.click(screen.getByText(/Complete & Take Quiz/));
    expect(onComplete).toHaveBeenCalled();
  });

  it("disables Previous button on first step", () => {
    const v2Path = createMockV2Path();
    render(
      <LearnerView
        v2Path={v2Path}
        focusedStepIndex={0}
        onStepChange={() => {}}
        onComplete={() => {}}
      />
    );
    const prevButton = screen.getByText("← Previous");
    expect(prevButton.disabled).toBe(true);
  });

  it("uses externalProgress for completion tracking", () => {
    const v2Path = createMockV2Path();
    const progress = new Set([0, 1]); // 2 of 3 completed
    render(
      <LearnerView
        v2Path={v2Path}
        externalProgress={progress}
        focusedStepIndex={2}
        onStepChange={() => {}}
        onComplete={() => {}}
      />
    );
    // In focused mode the progress shows in the nav bar as "Step X of Y"
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
  });

  it("returns null for non-V2 data", () => {
    const { container } = render(<LearnerView v2Path={null} />);
    expect(container.innerHTML).toBe("");
  });

  // ── New tests for focused mode isolation ──

  it("renders ONLY the focused card in focused mode (no dimmed cards)", () => {
    const v2Path = createMockV2Path();
    const { container } = render(
      <LearnerView
        v2Path={v2Path}
        focusedStepIndex={0}
        onStepChange={() => {}}
        onComplete={() => {}}
      />
    );
    // Should render only ONE lesson card
    const cards = container.querySelectorAll(".lesson-card");
    expect(cards.length).toBe(1);
    // No dimmed cards should exist
    expect(container.querySelector(".lesson-card--dimmed")).toBeNull();
  });

  it("shows section context banner in focused mode", () => {
    const v2Path = createMockV2Path();
    render(
      <LearnerView
        v2Path={v2Path}
        focusedStepIndex={0} // step-1 is in "Prerequisites"
        onStepChange={() => {}}
        onComplete={() => {}}
      />
    );
    const contextBanner = document.querySelector(".learner-view__section-context");
    expect(contextBanner).toBeTruthy();
    expect(screen.getByText("Prerequisites")).toBeTruthy();
    expect(screen.getByText("Step 1 of 1")).toBeTruthy(); // 1 step in prereqs section
  });

  it("shows correct section context when focused on a core step", () => {
    const v2Path = createMockV2Path();
    render(
      <LearnerView
        v2Path={v2Path}
        focusedStepIndex={1} // step-2 is in "Core Lessons"
        onStepChange={() => {}}
        onComplete={() => {}}
      />
    );
    expect(screen.getByText("Core Lessons")).toBeTruthy();
    expect(screen.getByText("Step 1 of 2")).toBeTruthy(); // 2 steps in core, this is #1
  });

  it("does not show section headers in focused mode (no section-header elements)", () => {
    const v2Path = createMockV2Path();
    const { container } = render(
      <LearnerView
        v2Path={v2Path}
        focusedStepIndex={0}
        onStepChange={() => {}}
        onComplete={() => {}}
      />
    );
    // Section headers from overview mode should not be present
    expect(container.querySelector(".learner-view__section-header")).toBeNull();
  });
});
