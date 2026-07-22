/**
 * Component Smoke Tests
 *
 * Renders key UI components with minimal props to verify they don't crash.
 * These tests catch import errors, missing dependencies, and render-time
 * exceptions that would otherwise only surface in production.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
// 6. AccessibilityPanel
// ═══════════════════════════════════════════════════════════════════════════════

import AccessibilityPanel from "../components/Settings/AccessibilityPanel";
import { fireEvent } from "@testing-library/react";

describe("AccessibilityPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-font");
    document.documentElement.removeAttribute("data-motion");
  });

  it("should render the trigger button", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: "Accessibility settings" });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  });

  it("should open and close the popover", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: "Accessibility settings" });

    // Open
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Accessibility settings" })).toBeTruthy();
    expect(screen.getByText("Dyslexic-friendly font")).toBeTruthy();

    // Close
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("should restore focus to the trigger on close", async () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: "Accessibility settings" });

    // Focus the trigger and click
    trigger.focus();
    fireEvent.click(trigger);

    // Dialog is open, now close it
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    // Focus should be restored to the trigger
    expect(document.activeElement).toBe(trigger);
  });

  it("should trap focus inside the popover", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByRole("button", { name: "Accessibility settings" });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    const focusable = Array.from(
      dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
    expect(focusable.length).toBeGreaterThan(1);

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus last element and press Tab -> should wrap to first
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // Focus first element and press Shift+Tab -> should wrap to last
    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
