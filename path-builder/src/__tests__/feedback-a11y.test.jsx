import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FeedbackModal from "../components/Feedback/FeedbackModal";

// Mock CSS
vi.mock("../components/Feedback/FeedbackModal.css", () => ({}));
vi.mock("../../utils/logger", () => ({ devLog: vi.fn() }));

describe("FeedbackModal Accessibility and UX", () => {
  it("should have correct accessibility attributes for type buttons", () => {
    render(<FeedbackModal isOpen={true} onClose={() => {}} />);

    const bugBtn = screen.getByRole("button", { name: /Bug Report/i });
    const featureBtn = screen.getByRole("button", { name: /Feature Request/i });
    const generalBtn = screen.getByRole("button", { name: /General/i });

    // Initial state (bug is default)
    expect(bugBtn.getAttribute("aria-pressed")).toBe("true");
    expect(featureBtn.getAttribute("aria-pressed")).toBe("false");
    expect(generalBtn.getAttribute("aria-pressed")).toBe("false");

    // Click Feature Request
    fireEvent.click(featureBtn);
    expect(bugBtn.getAttribute("aria-pressed")).toBe("false");
    expect(featureBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("should display character count and enforce maxLength", () => {
    render(<FeedbackModal isOpen={true} onClose={() => {}} />);

    const textarea = screen.getByLabelText(/Describe the issue|Tell us about/);
    expect(textarea.getAttribute("maxLength")).toBe("2000");
    expect(textarea.getAttribute("aria-describedby")).toBe("feedback-char-count");

    const charCount = screen.getByRole("status");
    expect(charCount.textContent).toContain("0 / 2000");

    fireEvent.change(textarea, { target: { value: "Hello World" } });
    expect(charCount.textContent).toContain("11 / 2000");
  });

  it("should show required indicator", () => {
    const { container } = render(<FeedbackModal isOpen={true} onClose={() => {}} />);

    const srRequired = container.querySelector(".sr-only");
    expect(srRequired.textContent).toBe("(required)");

    const star = container.querySelector(".required-star");
    expect(star).toBeTruthy();
    expect(star.getAttribute("aria-hidden")).toBe("true");
  });
});
