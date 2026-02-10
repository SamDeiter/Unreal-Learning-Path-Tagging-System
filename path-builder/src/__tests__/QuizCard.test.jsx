/**
 * QuizCard Component Tests
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuizCard from "../components/GuidedPlayer/QuizCard";

// Mock quiz data
vi.mock("../data/quiz_questions.json", () => ({
  default: {
    "100_01": {
      Lumen_55: [
        {
          question: "What does Lumen provide in Unreal Engine 5?",
          options: [
            "Real-time global illumination",
            "Texture streaming",
            "Physics simulation",
            "Audio processing",
          ],
          correct: 0,
          explanation: "Lumen is UE5's real-time global illumination system.",
        },
        {
          question: "Which setting controls Lumen reflection quality?",
          options: ["Shadow Quality", "Reflection Method", "Anti-Aliasing", "Screen Percentage"],
          correct: 1,
          explanation: "The Reflection Method setting controls Lumen reflections.",
        },
      ],
    },
  },
}));

describe("QuizCard", () => {
  const defaultProps = {
    courseCode: "100_01",
    videoKey: "Lumen_55",
    onComplete: vi.fn(),
    onSkip: vi.fn(),
  };

  it("renders null when no quiz data exists for the course", () => {
    const { container } = render(
      <QuizCard courseCode="nonexistent" videoKey="test" onComplete={vi.fn()} onSkip={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the first question", () => {
    render(<QuizCard {...defaultProps} />);
    expect(screen.getByText("Quick Check")).toBeInTheDocument();
    expect(screen.getByText("What does Lumen provide in Unreal Engine 5?")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("renders all four answer options", () => {
    render(<QuizCard {...defaultProps} />);
    expect(screen.getByText("Real-time global illumination")).toBeInTheDocument();
    expect(screen.getByText("Texture streaming")).toBeInTheDocument();
    expect(screen.getByText("Physics simulation")).toBeInTheDocument();
    expect(screen.getByText("Audio processing")).toBeInTheDocument();
  });

  it("disables Check Answer button when no option selected", () => {
    render(<QuizCard {...defaultProps} />);
    const checkBtn = screen.getByText("Check Answer");
    expect(checkBtn).toBeDisabled();
  });

  it("enables Check Answer after selecting an option", () => {
    render(<QuizCard {...defaultProps} />);
    fireEvent.click(screen.getByText("Real-time global illumination"));
    expect(screen.getByText("Check Answer")).not.toBeDisabled();
  });

  it("reveals correct answer with explanation after checking", () => {
    render(<QuizCard {...defaultProps} />);
    fireEvent.click(screen.getByText("Real-time global illumination"));
    fireEvent.click(screen.getByText("Check Answer"));
    expect(
      screen.getByText("Lumen is UE5's real-time global illumination system.")
    ).toBeInTheDocument();
  });

  it("shows correct/incorrect styling when wrong answer is selected", () => {
    const { container } = render(<QuizCard {...defaultProps} />);
    fireEvent.click(screen.getByText("Texture streaming"));
    fireEvent.click(screen.getByText("Check Answer"));
    // The correct answer option should gain the .correct class
    const correctOption = container.querySelector(".quiz-option.correct");
    expect(correctOption).not.toBeNull();
    // The wrong answer should gain the .incorrect class
    const incorrectOption = container.querySelector(".quiz-option.incorrect");
    expect(incorrectOption).not.toBeNull();
  });

  it("advances to next question after answering", () => {
    render(<QuizCard {...defaultProps} />);
    // Answer Q1
    fireEvent.click(screen.getByText("Real-time global illumination"));
    fireEvent.click(screen.getByText("Check Answer"));
    // "Next Question" button — text content omits the ArrowRight SVG icon
    const nextBtn = screen.getByRole("button", { name: /next question/i });
    fireEvent.click(nextBtn);
    // Q2 should be visible
    expect(
      screen.getByText("Which setting controls Lumen reflection quality?")
    ).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("shows score summary after all questions answered", () => {
    render(<QuizCard {...defaultProps} />);
    // Answer Q1 correctly
    fireEvent.click(screen.getByText("Real-time global illumination"));
    fireEvent.click(screen.getByText("Check Answer"));
    fireEvent.click(screen.getByRole("button", { name: /next question/i }));
    // Answer Q2 correctly
    fireEvent.click(screen.getByText("Reflection Method"));
    fireEvent.click(screen.getByText("Check Answer"));
    fireEvent.click(screen.getByRole("button", { name: /see results/i }));
    // Score summary
    expect(screen.getByText("2/2 Correct")).toBeInTheDocument();
  });

  it("calls onSkip when Skip Quiz is clicked", () => {
    const onSkip = vi.fn();
    render(<QuizCard {...defaultProps} onSkip={onSkip} />);
    fireEvent.click(screen.getByText("Skip Quiz"));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("calls onComplete with score when Continue is clicked after finishing", () => {
    const onComplete = vi.fn();
    render(<QuizCard {...defaultProps} onComplete={onComplete} />);
    // Answer both questions
    fireEvent.click(screen.getByText("Real-time global illumination"));
    fireEvent.click(screen.getByText("Check Answer"));
    fireEvent.click(screen.getByRole("button", { name: /next question/i }));
    fireEvent.click(screen.getByText("Reflection Method"));
    fireEvent.click(screen.getByText("Check Answer"));
    fireEvent.click(screen.getByRole("button", { name: /see results/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith({ score: 2, total: 2 });
  });
});
