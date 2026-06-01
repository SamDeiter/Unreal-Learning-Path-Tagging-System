/**
 * Component Smoke Tests
 *
 * Renders key UI components with minimal props to verify they don't crash.
 * These tests catch import errors, missing dependencies, and render-time
 * exceptions that would otherwise only surface in production.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import LoadingSpinner from "../components/LoadingSpinner/LoadingSpinner";
import ErrorBoundary from "../components/ErrorBoundary";
import DiagnosisCard from "../components/ProblemFirst/DiagnosisCard";
import DiagnosisLoader from "../components/FixProblem/DiagnosisLoader";
import BridgeCard from "../components/GuidedPlayer/BridgeCard";
import AppSidebar from "../components/AppSidebar/AppSidebar";

// ── Mock CSS imports (jsdom doesn't support them) ──────────────────────────
vi.mock("../components/LoadingSpinner/LoadingSpinner.css", () => ({}));
vi.mock("../components/FixProblem/FixProblem.css", () => ({}));
vi.mock("../components/ProblemFirst/ProblemFirst.css", () => ({}));
vi.mock("../components/GuidedPlayer/GuidedPlayer.css", () => ({}));

vi.mock("../services/googleAuthService", () => ({
  signOutUser: vi.fn(),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// 1. LoadingSpinner
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// 6. AppSidebar
// ═══════════════════════════════════════════════════════════════════════════════

describe("AppSidebar", () => {
  const defaultProps = {
    tabs: [],
    activeTab: "adaptive",
    setActiveTab: vi.fn(),
    analyticsExpanded: false,
    setAnalyticsExpanded: vi.fn(),
    buildersExpanded: false,
    setBuildersExpanded: vi.fn(),
    newFeedbackCount: 0,
    currentUser: null,
    onRetakeQuiz: vi.fn(),
  };

  it("should render without crashing", () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText("UE5 LPB")).toBeTruthy();
  });

  it("should have aria-expanded and aria-hidden attributes on expandable sections", () => {
    const { container } = render(
      <AppSidebar {...defaultProps} buildersExpanded={true} analyticsExpanded={false} />
    );

    // Path Builders button - title from tabDefinitions.js
    const buildersBtn = screen.getByTitle(/Choose between different path generation engines/i);
    expect(buildersBtn.getAttribute("aria-expanded")).toBe("true");

    // Analytics button - title from tabDefinitions.js
    const analyticsBtn = screen.getByTitle(/Deep data insights into demand and coverage/i);
    expect(analyticsBtn.getAttribute("aria-expanded")).toBe("false");

    // Arrows
    const arrows = container.querySelectorAll(".sidebar-expand-arrow");
    expect(arrows.length).toBeGreaterThan(0);
    arrows.forEach((arrow) => {
      expect(arrow.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
