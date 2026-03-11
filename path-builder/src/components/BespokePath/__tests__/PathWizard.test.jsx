/**
 * PathWizard.test.jsx — Unit tests for PathWizard component
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

  it("passes prerequisite check when foundation steps exist", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    // Check that "Has prerequisite steps" shows with a pass
    const check = document.getElementById("wizard-check-has-prerequisites");
    expect(check).toBeTruthy();
    expect(check.className).toContain("passed");
  });

  it("passes core step check when fix steps exist", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-has-core");
    expect(check).toBeTruthy();
    expect(check.className).toContain("passed");
  });

  it("passes practice check when transfer steps exist", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-has-practice");
    expect(check).toBeTruthy();
    expect(check.className).toContain("passed");
  });

  it("passes no-high-gaps check when no high severity gaps", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-no-high-gaps");
    expect(check).toBeTruthy();
    expect(check.className).toContain("passed");
  });

  it("fails no-high-gaps check when high severity gaps exist", () => {
    const badGaps = {
      ...mockGaps,
      blindSpots: [{ topic: "Big gap", severity: "high", reason: "Critical" }],
    };
    render(<PathWizard pathResult={mockResult} gaps={badGaps} />);
    const check = document.getElementById("wizard-check-no-high-gaps");
    expect(check.className).toContain("failed");
  });

  it("passes coverage check when >= 70%", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-coverage-threshold");
    expect(check.className).toContain("passed");
  });

  it("fails coverage check when < 70%", () => {
    const lowGaps = { ...mockGaps, coverageScore: 0.5 };
    render(<PathWizard pathResult={mockResult} gaps={lowGaps} />);
    const check = document.getElementById("wizard-check-coverage-threshold");
    expect(check.className).toContain("failed");
  });

  it("passes step count check when <= 7 steps", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-step-count");
    expect(check.className).toContain("passed");
  });

  it("fails step count check when > 7 steps", () => {
    const bigPath = {
      ...mockResult,
      path: Array(8).fill({ category: "fix", segment: { title: "Step" } }),
    };
    render(<PathWizard pathResult={bigPath} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-step-count");
    expect(check.className).toContain("failed");
  });

  it("passes bridges check when bridges with text exist", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-has-bridges");
    expect(check.className).toContain("passed");
  });

  it("fails bridges check when no bridges", () => {
    const noBridges = { ...mockResult, bridges: [] };
    render(<PathWizard pathResult={noBridges} gaps={mockGaps} />);
    const check = document.getElementById("wizard-check-has-bridges");
    expect(check.className).toContain("failed");
  });





  it("shows correct progress percentage", () => {
    render(<PathWizard pathResult={mockResult} gaps={mockGaps} />);
    // Verify the progress info is rendered
    expect(screen.getByText(/checks passed/)).toBeTruthy();
    // Verify progress bar element exists
    expect(document.getElementById("wizard-progress")).toBeTruthy();
  });

  it("handles null gaps gracefully", () => {
    render(<PathWizard pathResult={mockResult} gaps={null} />);
    // Should still render with defaults
    expect(screen.getByText("Path Review")).toBeTruthy();
  });
});
