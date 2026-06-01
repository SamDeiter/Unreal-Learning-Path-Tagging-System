/**
 * Component Smoke Tests
 *
 * Renders key UI components with minimal props to verify they don't crash.
 * These tests catch import errors, missing dependencies, and render-time
 * exceptions that would otherwise only surface in production.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mock CSS imports (jsdom doesn't support them) ──────────────────────────
vi.mock("../components/LoadingSpinner/LoadingSpinner.css", () => ({}));
vi.mock("../components/FixProblem/FixProblem.css", () => ({}));
vi.mock("../components/ProblemFirst/ProblemFirst.css", () => ({}));
vi.mock("../components/GuidedPlayer/GuidedPlayer.css", () => ({}));

// ═══════════════════════════════════════════════════════════════════════════════
// 1. LoadingSpinner
// ═══════════════════════════════════════════════════════════════════════════════

import LoadingSpinner from "../components/LoadingSpinner/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("should render without crashing", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector(".loading-spinner-container")).toBeTruthy();
  });

  it("should display default message", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("should display custom message", () => {
    render(<LoadingSpinner message="Fetching courses..." />);
    expect(screen.getByText("Fetching courses...")).toBeTruthy();
  });

  it("should have correct accessibility attributes", () => {
    const { container } = render(<LoadingSpinner />);
    const spinnerContainer = container.querySelector(".loading-spinner-container");
    expect(spinnerContainer.getAttribute("role")).toBe("status");
    expect(spinnerContainer.getAttribute("aria-live")).toBe("polite");

    const visualSpinner = container.querySelector(".loading-spinner");
    expect(visualSpinner.getAttribute("aria-hidden")).toBe("true");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ErrorBoundary
// ═══════════════════════════════════════════════════════════════════════════════

import ErrorBoundary from "../components/ErrorBoundary";

describe("ErrorBoundary", () => {
  it("should render children when no error", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Content</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("should show fallback UI when child throws", () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    function ThrowingChild() {
      throw new Error("Test error");
    }

    render(
      <ErrorBoundary showDetails>
        <ThrowingChild />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/)).toBeTruthy();
    expect(screen.getByText(/Try Again/)).toBeTruthy();
    spy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DiagnosisCard
// ═══════════════════════════════════════════════════════════════════════════════

import DiagnosisCard from "../components/ProblemFirst/DiagnosisCard";

describe("DiagnosisCard", () => {
  it("should render null when no diagnosis", () => {
    const { container } = render(<DiagnosisCard diagnosis={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("should render with full diagnosis data", () => {
    const diagnosis = {
      diagnosis_id: "test-id-12345678",
      problem_summary: "Lumen reflections are flickering",
      root_causes: ["Screen space reflections disabled", "Lumen quality too low"],
      signals_to_watch_for: ["Flickering in reflective surfaces"],
      variables_that_matter: ["r.Lumen.Reflections.Allow", "Ray count"],
      variables_that_do_not: ["Frame rate", "CPU count"],
      generalization_scope: ["All reflective materials"],
    };

    render(<DiagnosisCard diagnosis={diagnosis} />);
    expect(screen.getByText("🔬 Diagnosis")).toBeTruthy();
    expect(screen.getByText("Lumen reflections are flickering")).toBeTruthy();
    expect(screen.getByText(/Root Causes/)).toBeTruthy();
  });

  it("should handle partial diagnosis data", () => {
    const partial = {
      problem_summary: "Test problem",
      root_causes: [],
    };
    const { container } = render(<DiagnosisCard diagnosis={partial} />);
    expect(container.querySelector(".diagnosis-card")).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DiagnosisLoader
// ═══════════════════════════════════════════════════════════════════════════════

import DiagnosisLoader from "../components/FixProblem/DiagnosisLoader";

describe("DiagnosisLoader", () => {
  it("should render without crashing", () => {
    const { container } = render(<DiagnosisLoader />);
    expect(container.querySelector(".dx-loader")).toBeTruthy();
  });

  it("should display the query when provided", () => {
    render(<DiagnosisLoader query="Lumen flickering" />);
    expect(screen.getByText(/Lumen flickering/)).toBeTruthy();
  });

  it("should show progress phases", () => {
    render(<DiagnosisLoader />);
    expect(screen.getByText(/Analyzing your problem/)).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. BridgeCard
// ═══════════════════════════════════════════════════════════════════════════════

import BridgeCard from "../components/GuidedPlayer/BridgeCard";

// ═══════════════════════════════════════════════════════════════════════════════
// 6. FeedbackModal
// ═══════════════════════════════════════════════════════════════════════════════

import FeedbackModal from "../components/Feedback/FeedbackModal";

vi.mock("../components/Feedback/FeedbackModal.css", () => ({}));

describe("FeedbackModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    user: { uid: "test-user", email: "test@example.com" },
  };

  it("should render when open", () => {
    render(<FeedbackModal {...defaultProps} />);
    expect(screen.getByText(/Send Feedback/)).toBeTruthy();
  });

  it("should display character count and required indicators", () => {
    render(<FeedbackModal {...defaultProps} />);

    // Check for character count
    const charCount = screen.getByText(/0 characters/);
    expect(charCount).toBeTruthy();
    expect(charCount.getAttribute("role")).toBe("status");
    expect(charCount.getAttribute("aria-live")).toBe("polite");

    // Check for required asterisk and visually hidden text
    expect(screen.getByText("*")).toBeTruthy();
    expect(screen.getByText("(required)")).toBeTruthy();

    // Check textarea accessibility attributes
    const textarea = screen.getByLabelText(/Describe the issue|Tell us about your suggestion/);
    expect(textarea.getAttribute("aria-required")).toBe("true");
    expect(textarea.getAttribute("aria-describedby")).toBe("feedback-char-count");
  });
});

describe("BridgeCard", () => {
  it("should render a transition bridge", () => {
    const content = {
      type: "transition",
      text: "Moving to next course",
      subtext: "with a new instructor",
    };
    const onContinue = vi.fn();

    render(<BridgeCard bridgeContent={content} onContinue={onContinue} />);
    expect(screen.getByText("Moving to next course")).toBeTruthy();
    expect(screen.getByText("with a new instructor")).toBeTruthy();
    expect(screen.getByText("Continue →")).toBeTruthy();
  });

  it("should fire onContinue when button clicked", async () => {
    const content = { type: "continuation", text: "Next up" };
    const onContinue = vi.fn();

    render(<BridgeCard bridgeContent={content} onContinue={onContinue} />);
    const btn = screen.getByText("Continue →");
    btn.click();
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
