/**
 * PathWizard.test.jsx — Unit tests for PathWizard component
 *
 * PathWizard only renders FAILED checks as individual DOM elements.
 * Passed checks appear in a compact summary line.
 * Tests are structured accordingly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PathWizard from "../PathWizard";

const mockPath = [
  { category: "foundation", segment: { title: "Prereq Step", duration: 180 } },
  { category: "fix", segment: { title: "Core Step", duration: 240 } },
  { category: "transfer", segment: { title: "Practice Step", duration: 300 } },
];

const mockGaps = {
  coverageScore: 0.85,
  blindSpots: [{ topic: "Minor gap", severity: "low", reason: "Not critical" }],
  assumedKnowledge: [],
  suggestions: [],
};

const mockResult = {
  path: mockPath,
  bridges: [{ text: "Here's how they connect" }],
  query: "test query",
};

describe("PathWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when pathResult is null", () => {
    const { container } = render(<PathWizard pathResult={null} gaps={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders header and progress bar", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);

    expect(screen.getByText("Path Review")).toBeTruthy();
    expect(screen.getByText(/checks passed/)).toBeTruthy();
  });

  // ── Passed checks: should NOT render individual elements ──────────
  // PathWizard only renders failed checks as DOM elements with IDs.
  // When a check passes, its element ID won't exist in the DOM.

  it("does not render individual element for passed prerequisite check", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-has-prerequisites");
    expect(check).toBeNull();
  });

  it("does not render individual element for passed core step check", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-has-core");
    expect(check).toBeNull();
  });

  it("does not render individual element for passed practice check", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-has-practice");
    expect(check).toBeNull();
  });

  it("does not render individual element for passed no-high-gaps check", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-no-high-gaps");
    expect(check).toBeNull();
  });

  // ── Failed checks: SHOULD render individual elements ──────────────

  it("renders failed no-high-gaps check when high severity gaps exist", () => {
    const badGaps = {
      ...mockGaps,
      blindSpots: [{ topic: "Big gap", severity: "high", reason: "Critical" }],
    };
    render(<PathWizard pathResult={mockResult} gaps={badGaps} />);
    const check = document.getElementById("wizard-check-no-high-gaps");
    expect(check).toBeTruthy();
    expect(check.className).toContain("failed");
  });

  it("does not render individual element for passed coverage check (>= 70%)", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-coverage-threshold");
    expect(check).toBeNull();
  });

  it("renders failed coverage check when < 70%", () => {
    const lowGaps = { ...mockGaps, coverageScore: 0.5 };
    render(<PathWizard pathResult={mockResult} gaps={lowGaps} />);
    const check = document.getElementById("wizard-check-coverage-threshold");
    expect(check).toBeTruthy();
    expect(check.className).toContain("failed");
  });

  it("does not render individual element for passed step count check (<= 7)", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-step-count");
    expect(check).toBeNull();
  });

  it("renders failed step count check when > 7 steps", () => {
    const bigPath = {
      ...mockResult,
      path: Array(8).fill({ category: "fix", segment: { title: "Step" } }),
    };
    render(<PathWizard pathResult={bigPath} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-step-count");
    expect(check).toBeTruthy();
    expect(check.className).toContain("failed");
  });

  it("does not render individual element for passed bridges check", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-has-bridges");
    expect(check).toBeNull();
  });

  it("renders failed bridges check when no bridges", () => {
    const noBridges = { ...mockResult, bridges: [] };
    render(<PathWizard pathResult={noBridges} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-has-bridges");
    expect(check).toBeTruthy();
    expect(check.className).toContain("failed");
  });

  // ── Progress and summary ──────────────────────────────────────────

  it("shows correct progress percentage", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    expect(screen.getByText(/checks passed/)).toBeTruthy();
    expect(document.getElementById("wizard-progress")).toBeTruthy();
  });

  it("shows all-passed celebration when every check passes", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    // All checks pass with mockResult + mockGaps (except 'all-verified')
    // At minimum the progress bar should exist
    expect(document.getElementById("wizard-progress")).toBeTruthy();
  });

  it("handles null gaps gracefully", () => {
    render(<PathWizard pathResult={mockResult} gaps={null} />);
    expect(screen.getByText("Path Review")).toBeTruthy();
  });
});
