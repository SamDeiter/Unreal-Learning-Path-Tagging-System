/**
 * LessonPage — smoke tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockGenerate = vi.fn();
const mockLoadById = vi.fn();
let mockLessonState = {
  lesson: null,
  lessonId: null,
  sessionId: null,
  loading: false,
  error: null,
  generate: mockGenerate,
  loadById: mockLoadById,
  reset: vi.fn(),
};

vi.mock("../../hooks/useLesson", () => ({
  default: () => mockLessonState,
}));

vi.mock("../chat/FeedbackBar", () => ({
  default: ({ sessionId }) => <div data-testid="feedback-bar">fb:{sessionId}</div>,
}));

vi.mock("../BespokePath/QuizEngine", () => ({
  default: ({ questions }) => <div data-testid="quiz-engine">quiz:{questions.length}</div>,
}));

vi.mock("../BespokePath/DeepDiveSection", () => ({
  default: ({ deepDive }) => <div data-testid="deepdive">dd:{deepDive.length}</div>,
}));

import LessonPage from "./LessonPage";

function setHash(hash) {
  window.location.hash = hash;
}

const sampleLesson = {
  topic: "Lumen reflections",
  query: "why are my reflections noisy",
  diagnosis: {
    problem_summary: "Your scene relies on hardware ray tracing without enough samples.",
    root_causes: [
      { title: "Low sample count", description: "Increase samples." },
      "Dynamic geometry changes",
    ],
    signals_to_watch_for: ["Flicker", "Fireflies"],
    scope: "lighting",
  },
  objectives: {
    fix_specific: ["Stabilize Lumen reflections in your scene"],
    transferable: ["Understand how TSR interacts with Lumen"],
  },
  concept: {
    notes: "Lumen reflections notes.",
    featuredVideo: null,
    deepDiveSections: [{ type: "concept", title: "How Lumen works", content: "details" }],
  },
  takeaways: ["Use enough samples", "Watch for dynamic geometry"],
  quiz: {
    questions: [
      {
        q: "What causes flicker?",
        options: ["Too few samples", "Ray miss", "Cache churn", "All of the above"],
        correctIndex: 3,
        explanation: "All of these can contribute.",
      },
    ],
  },
  widgetHtml: null,
  generatedAt: 1700000000000,
};

describe("LessonPage", () => {
  beforeEach(() => {
    mockGenerate.mockReset();
    mockLoadById.mockReset();
    mockLessonState = {
      lesson: null,
      lessonId: null,
      sessionId: null,
      loading: false,
      error: null,
      generate: mockGenerate,
      loadById: mockLoadById,
      reset: vi.fn(),
    };
  });

  it("renders loading skeleton when loading", () => {
    mockLessonState.loading = true;
    setHash("lesson/abc123");
    const { container } = render(<LessonPage />);
    expect(container.querySelector(".lesson-page--loading")).toBeTruthy();
  });

  it("renders error state with back button when error is set", () => {
    mockLessonState.error = "nope";
    setHash("lesson/abc123");
    render(<LessonPage />);
    expect(screen.getByText(/nope/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /back to chat/i })).toBeTruthy();
  });

  it("loads by id when hash is #lesson/:id", async () => {
    setHash("lesson/abc123");
    render(<LessonPage />);
    await waitFor(() => {
      expect(mockLoadById).toHaveBeenCalledWith("abc123");
    });
  });

  it("generates a lesson when hash is #lesson/new?query=...", async () => {
    setHash("lesson/new?query=lumen%20flicker");
    render(<LessonPage />);
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith({ query: "lumen flicker" });
    });
  });

  it("renders the full lesson layout when a lesson is present", () => {
    mockLessonState.lesson = sampleLesson;
    mockLessonState.lessonId = "abc123";
    mockLessonState.sessionId = "sess_1";
    setHash("lesson/abc123");
    render(<LessonPage />);

    expect(screen.getByText("Lumen reflections")).toBeTruthy();
    expect(screen.getByText(sampleLesson.diagnosis.problem_summary)).toBeTruthy();
    expect(screen.getByText(/What you'll learn/i)).toBeTruthy();
    expect(screen.getByText(/Flicker/)).toBeTruthy();
    expect(screen.getByText(/Fireflies/)).toBeTruthy();
    expect(screen.getByText(/Key takeaways/i)).toBeTruthy();
    expect(screen.getByTestId("quiz-engine")).toBeTruthy();
    expect(screen.getByTestId("deepdive")).toBeTruthy();
    expect(screen.getByTestId("feedback-bar").textContent).toContain("sess_1");
    expect(screen.getByText(/Interactive demo unavailable/i)).toBeTruthy();
  });
});
