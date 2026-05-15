import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import DiagnosisLoader from "../DiagnosisLoader";

// Mock CSS imports
vi.mock("../FixProblem.css", () => ({}));

describe("DiagnosisLoader Accessibility", () => {
  it("should have correct accessibility attributes for the container", () => {
    const { container } = render(<DiagnosisLoader />);
    const loader = container.querySelector(".dx-loader");
    expect(loader.getAttribute("role")).toBe("status");
    expect(loader.getAttribute("aria-live")).toBe("polite");
  });

  it("should have correct accessibility attributes for the progressbar", () => {
    const { container } = render(<DiagnosisLoader />);
    const progressBar = container.querySelector(".dx-progress-bar");
    expect(progressBar.getAttribute("role")).toBe("progressbar");
    expect(progressBar.getAttribute("aria-valuemin")).toBe("0");
    expect(progressBar.getAttribute("aria-valuemax")).toBe("100");
    expect(progressBar.getAttribute("aria-valuenow")).toBe("33"); // 1/3 phases
    expect(progressBar.getAttribute("aria-valuetext")).toBe("Analyzing your problem...");
  });

  it("should update aria-valuenow and aria-valuetext when phase changes", () => {
    vi.useFakeTimers();
    const { container } = render(<DiagnosisLoader />);
    const progressBar = container.querySelector(".dx-progress-bar");

    // Phase 1 (index 0)
    expect(progressBar.getAttribute("aria-valuenow")).toBe("33");
    expect(progressBar.getAttribute("aria-valuetext")).toBe("Analyzing your problem...");

    // Advance to Phase 2 (index 1)
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(progressBar.getAttribute("aria-valuenow")).toBe("67");
    expect(progressBar.getAttribute("aria-valuetext")).toBe("Searching knowledge base...");

    // Advance to Phase 3 (index 2)
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(progressBar.getAttribute("aria-valuenow")).toBe("100");
    expect(progressBar.getAttribute("aria-valuetext")).toBe("Building your fix...");

    vi.useRealTimers();
  });
});
