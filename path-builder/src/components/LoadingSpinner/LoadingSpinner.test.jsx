import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import LoadingSpinner from "./LoadingSpinner";

describe("LoadingSpinner Accessibility", () => {
  it("should have role='status' and aria-live='polite'", () => {
    const { container } = render(<LoadingSpinner />);
    const spinnerContainer = container.querySelector(".loading-spinner-container");
    expect(spinnerContainer).toBeTruthy();
    expect(spinnerContainer.getAttribute("role")).toBe("status");
    expect(spinnerContainer.getAttribute("aria-live")).toBe("polite");
  });

  it("should have aria-hidden='true' on the visual spinner", () => {
    const { container } = render(<LoadingSpinner />);
    const spinner = container.querySelector(".loading-spinner");
    expect(spinner).toBeTruthy();
    expect(spinner.getAttribute("aria-hidden")).toBe("true");
  });
});
