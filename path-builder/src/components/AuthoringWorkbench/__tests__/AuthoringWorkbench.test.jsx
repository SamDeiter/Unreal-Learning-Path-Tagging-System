/**
 * AuthoringWorkbench.test.jsx
 *
 * Unit + integration tests for the Authoring Workbench component
 * and its CoursePreview sub-component.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────

vi.mock("../../../hooks/useAuthoringWorkbench", () => {
  const AUTHORING_STAGES = {
    PLAN: "plan",
    REVIEW: "review",
    BRIEF: "brief",
    LINK: "link",
    EXPORT: "export",
  };

  const defaultHookReturn = {
    stage: AUTHORING_STAGES.PLAN,
    stageOrder: [AUTHORING_STAGES.PLAN, AUTHORING_STAGES.REVIEW, AUTHORING_STAGES.BRIEF, AUTHORING_STAGES.LINK, AUTHORING_STAGES.EXPORT],
    currentStageIndex: 0,
    v2Path: null,
    briefs: [],
    briefMarkdown: "",
    loading: false,
    error: null,
    progress: { current: 0, total: 0, label: "" },
    savedDrafts: [],
    courseStats: { totalLessons: 0, totalMinutes: 0, linkedVideos: 0, quizCount: 0, moduleCount: 0 },
    reuseReport: null,
    analyzingReuse: false,
    reuseProgress: { current: 0, total: 0 },
    generatingQuizFor: null,
    topic: "",
    DIFFICULTY_LEVELS: ["Beginner", "Intermediate", "Advanced"],
    LESSON_TYPES: ["Video", "Quiz", "Walkthrough", "Challenge"],
    generatePlan: vi.fn(),
    goNext: vi.fn(),
    goBack: vi.fn(),
    goToStage: vi.fn(),
    canGoNext: vi.fn(() => false),
    updateStepField: vi.fn(),
    removeStep: vi.fn(),
    reorderStep: vi.fn(),
    updateSectionField: vi.fn(),
    addLesson: vi.fn(),
    addSection: vi.fn(),
    removeSection: vi.fn(),
    reorderSection: vi.fn(),
    moveStepToSection: vi.fn(),
    addQuizQuestion: vi.fn(),
    removeQuizQuestion: vi.fn(),
    updateQuizQuestion: vi.fn(),
    generateQuizForStep: vi.fn(),
    updateCourseField: vi.fn(),
    generateBriefs: vi.fn(),
    updateBriefField: vi.fn(),
    updateBriefListItem: vi.fn(),
    linkVideo: vi.fn(),
    exportScorm: vi.fn(),
    exportV3: vi.fn(),
    downloadBriefMarkdown: vi.fn(),
    saveDraft: vi.fn(),
    loadDraft: vi.fn(),
    deleteDraft: vi.fn(),
    reset: vi.fn(),
    runReuseAnalysis: vi.fn(),
    autoLinkReusableSteps: vi.fn(),
  };

  let mockReturn = { ...defaultHookReturn };

  const useAuthoringWorkbench = () => mockReturn;
  useAuthoringWorkbench.__setMockReturn = (overrides) => {
    mockReturn = { ...defaultHookReturn, ...overrides };
  };
  useAuthoringWorkbench.__resetMockReturn = () => {
    mockReturn = { ...defaultHookReturn };
  };

  return { default: useAuthoringWorkbench, AUTHORING_STAGES };
});

vi.mock("../AuthoringWorkbench.css", () => ({}));
vi.mock("../ReusePanel", () => ({ default: () => null }));

import AuthoringWorkbench from "../AuthoringWorkbench";
import useAuthoringWorkbench, { AUTHORING_STAGES } from "../../../hooks/useAuthoringWorkbench";
import CoursePreview from "../CoursePreview";

// ── Test Fixtures ────────────────────────────────────────────

const MOCK_PATH = {
  title: "UE5 Learning Path: Slow Motion",
  difficulty: "intermediate",
  learnerGoal: "Master slow-motion effects in UE5",
  sections: [
    {
      id: "s1",
      title: "Understanding Time Dilation",
      description: "Background concepts",
      phase: "prerequisite",
      steps: [
        {
          id: "step-1",
          title: "Time Dilation Basics",
          lessonType: "Video",
          whyThisMatters: "Core concept for all slow-mo effects",
          commonMistake: "Forgetting to reset dilation",
          estimatedMinutes: 5,
          video: { url: "https://www.youtube.com/watch?v=abc123" },
          quiz: null,
        },
        {
          id: "quiz-1",
          title: "Knowledge Check",
          lessonType: "Quiz",
          whyThisMatters: "Test your understanding",
          estimatedMinutes: 3,
          video: null,
          quiz: {
            questions: [
              {
                text: "What does Time Dilation affect?",
                options: ["Tick rate", "Frame rate", "Resolution", "Audio"],
                correctIndex: 0,
                explanation: "Time dilation scales the tick rate.",
              },
            ],
          },
        },
      ],
    },
  ],
};

const MOCK_STATS = {
  totalLessons: 2,
  totalMinutes: 8,
  linkedVideos: 1,
  quizCount: 1,
  moduleCount: 1,
};

// ── AuthoringWorkbench Tests ─────────────────────────────────

describe("AuthoringWorkbench", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthoringWorkbench.__resetMockReturn();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders the stepper with stage labels visible", () => {
    render(<AuthoringWorkbench />);
    expect(screen.getByText("Plan")).toBeTruthy();
    expect(screen.getByText("Review")).toBeTruthy();
    expect(screen.getByText("Export")).toBeTruthy();
  });

  it("renders Plan stage topic input", () => {
    render(<AuthoringWorkbench />);
    const topicInput = screen.getByPlaceholderText(/e\.g\./i);
    expect(topicInput).toBeTruthy();
  });

  it("reads demand payload from localStorage on mount", () => {
    const payload = {
      query: "Niagara particle systems",
      suggestion: { topic: "Niagara", demandScore: 85, gap: 60, category: "VFX" },
    };
    localStorage.setItem("demand-start-authoring-payload", JSON.stringify(payload));

    render(<AuthoringWorkbench />);

    const topicInput = screen.getByPlaceholderText(/e\.g\./i);
    expect(topicInput.value).toBe("Niagara particle systems");
  });

  it("clears localStorage payload after reading", () => {
    const payload = { query: "Niagara", suggestion: { topic: "Niagara" } };
    localStorage.setItem("demand-start-authoring-payload", JSON.stringify(payload));

    render(<AuthoringWorkbench />);

    expect(localStorage.getItem("demand-start-authoring-payload")).toBeNull();
  });

  it("renders course title input in Review stage", () => {
    useAuthoringWorkbench.__setMockReturn({
      stage: AUTHORING_STAGES.REVIEW,
      currentStageIndex: 1,
      v2Path: MOCK_PATH,
      courseStats: MOCK_STATS,
    });

    render(<AuthoringWorkbench />);
    const titleInput = screen.getByDisplayValue("UE5 Learning Path: Slow Motion");
    expect(titleInput).toBeTruthy();
  });
});

// ── CoursePreview Tests ──────────────────────────────────────

describe("CoursePreview", () => {
  it("renders empty state when path is null", () => {
    const { container } = render(<CoursePreview path={null} stats={MOCK_STATS} />);
    // When path is null, the component renders empty or placeholder content
    expect(container.firstChild).toBeTruthy();
  });

  it("renders hero title from path", () => {
    render(<CoursePreview path={MOCK_PATH} stats={MOCK_STATS} />);
    expect(screen.getByText("UE5 Learning Path: Slow Motion")).toBeTruthy();
  });

  it("renders module header with number and title", () => {
    render(<CoursePreview path={MOCK_PATH} stats={MOCK_STATS} />);
    expect(screen.getByText("MODULE 1")).toBeTruthy();
    // Title may appear in multiple elements
    const titleElements = screen.getAllByText("Understanding Time Dilation");
    expect(titleElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders lesson cards with titles", () => {
    render(<CoursePreview path={MOCK_PATH} stats={MOCK_STATS} />);
    expect(screen.getByText("Time Dilation Basics")).toBeTruthy();
    expect(screen.getByText("Knowledge Check")).toBeTruthy();
  });

  it("play button expands inline preview for video lesson", () => {
    render(<CoursePreview path={MOCK_PATH} stats={MOCK_STATS} />);

    const playButtons = screen.getAllByText("▶");
    expect(playButtons.length).toBe(2);

    // Click the first (video lesson)
    fireEvent.click(playButtons[0]);

    // Should show "Why This Matters" content
    expect(screen.getByText(/Core concept for all slow-mo effects/)).toBeTruthy();
    // Button should now show collapse arrow
    expect(screen.getByText("▼")).toBeTruthy();
  });

  it("play button toggles back to collapsed on second click", () => {
    render(<CoursePreview path={MOCK_PATH} stats={MOCK_STATS} />);

    const playButtons = screen.getAllByText("▶");
    fireEvent.click(playButtons[0]); // expand
    fireEvent.click(screen.getByText("▼")); // collapse

    // Content should be hidden
    expect(screen.queryByText(/Core concept for all slow-mo effects/)).toBeFalsy();
  });

  it("quiz play button shows quiz preview with questions", () => {
    render(<CoursePreview path={MOCK_PATH} stats={MOCK_STATS} />);

    const playButtons = screen.getAllByText("▶");
    // Click the second button (quiz lesson)
    fireEvent.click(playButtons[1]);

    // Quiz header - uses regex to match partial text
    expect(screen.getByText(/Quiz Preview/)).toBeTruthy();
    // Question text has Q1. prefix: "Q1. What does Time Dilation affect?"
    expect(screen.getByText(/What does Time Dilation affect/)).toBeTruthy();
    // One of the options
    expect(screen.getByText(/Tick rate/)).toBeTruthy();
  });

  it("renders difficulty badge", () => {
    render(<CoursePreview path={MOCK_PATH} stats={MOCK_STATS} />);
    expect(screen.getByText("intermediate")).toBeTruthy();
  });

  it("renders stats in hero section", () => {
    const { container } = render(<CoursePreview path={MOCK_PATH} stats={MOCK_STATS} />);
    const badge = container.querySelector(".aw-duration-badge");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain("8");
    expect(badge.textContent).toContain("2");
  });
});
