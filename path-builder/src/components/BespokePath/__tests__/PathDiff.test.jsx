/**
 * PathDiff.test.jsx — Unit tests for the PathDiff component
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PathDiff from "../PathDiff";

// Mock step factories
const makeStep = (title, category = "core") => ({
  title,
  category,
  segment: { title, text: `Content about ${title}` },
});

describe("PathDiff", () => {
  it("renders empty state when no steps provided", () => {
    render(<PathDiff />);
    expect(screen.getByText(/no path data to compare/i)).toBeTruthy();
  });

  it("renders empty state when currentSteps is empty array", () => {
    render(<PathDiff originalSteps={[]} currentSteps={[]} />);
    expect(screen.getByText(/no path data to compare/i)).toBeTruthy();
  });

  it("renders all original steps as unchanged when no gaps filled", () => {
    const steps = [makeStep("Step A"), makeStep("Step B"), makeStep("Step C")];
    render(<PathDiff originalSteps={steps} currentSteps={steps} />);
    expect(screen.getByText("Step A")).toBeTruthy();
    expect(screen.getByText("Step B")).toBeTruthy();
    expect(screen.getByText("Step C")).toBeTruthy();
    expect(screen.getByText("No changes")).toBeTruthy();
  });

  it("highlights added steps when current has more than original", () => {
    const original = [makeStep("Step A"), makeStep("Step B")];
    const current = [...original, makeStep("Step C", "practice")];
    render(<PathDiff originalSteps={original} currentSteps={current} />);
    expect(screen.getByText(/1 step added/i)).toBeTruthy();
  });

  it("shows positive coverage delta", () => {
    const steps = [makeStep("A")];
    render(
      <PathDiff
        originalSteps={steps}
        currentSteps={[...steps, makeStep("B")]}
        originalCoverage={0.5}
        currentCoverage={0.75}
      />
    );
    expect(screen.getByText(/\+25% coverage/i)).toBeTruthy();
  });

  it("renders correct step indices", () => {
    const steps = [makeStep("A"), makeStep("B")];
    render(<PathDiff originalSteps={steps} currentSteps={steps} />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("handles multiple added steps", () => {
    const original = [makeStep("A")];
    const current = [...original, makeStep("B"), makeStep("C")];
    render(<PathDiff originalSteps={original} currentSteps={current} />);
    expect(screen.getByText(/2 steps added/i)).toBeTruthy();
  });

  it("shows category labels", () => {
    const steps = [makeStep("A", "foundation"), makeStep("B", "practice")];
    render(<PathDiff originalSteps={steps} currentSteps={steps} />);
    expect(screen.getByText("foundation")).toBeTruthy();
    expect(screen.getByText("practice")).toBeTruthy();
  });

  it("has proper ids for accessibility", () => {
    const steps = [makeStep("A")];
    const { container } = render(<PathDiff originalSteps={steps} currentSteps={steps} />);
    expect(container.querySelector("#path-diff-view")).toBeTruthy();
    expect(container.querySelector("#diff-step-0")).toBeTruthy();
  });
});
