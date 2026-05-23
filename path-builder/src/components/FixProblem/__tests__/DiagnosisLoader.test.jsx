import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import DiagnosisLoader from "../DiagnosisLoader";

// Mock CSS
vi.mock("../FixProblem.css", () => ({}));

describe("DiagnosisLoader Accessibility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should have correct ARIA roles and live regions", () => {
    const { container } = render(<DiagnosisLoader />);
    const loader = container.querySelector(".dx-loader");
    expect(loader.getAttribute("role")).toBe("status");
    expect(loader.getAttribute("aria-live")).toBe("polite");
  });

  it("should have a progressbar with correct initial attributes", () => {
    render(<DiagnosisLoader />);
    const progressbar = screen.getByRole("progressbar");
    expect(Number(progressbar.getAttribute("aria-valuenow"))).toBeCloseTo(33.33, 1);
    expect(progressbar.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar.getAttribute("aria-valuemax")).toBe("100");
    expect(progressbar.getAttribute("aria-valuetext")).toBe("Analyzing your problem...");
  });

  it("should update progressbar attributes as phases transition", () => {
    render(<DiagnosisLoader />);
    const progressbar = screen.getByRole("progressbar");

    // Advance to Phase 2
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(Number(progressbar.getAttribute("aria-valuenow"))).toBeCloseTo(66.66, 1);
    expect(progressbar.getAttribute("aria-valuetext")).toBe("Searching knowledge base...");

    // Advance to Phase 3
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(progressbar.getAttribute("aria-valuenow")).toBe("100");
    expect(progressbar.getAttribute("aria-valuetext")).toBe("Building your fix...");
  });
});
