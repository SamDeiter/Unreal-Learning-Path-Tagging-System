import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FeedbackModal from "../FeedbackModal";

// Mock services
vi.mock("../../services/feedbackService", () => ({
  submitFeedbackToFirestore: vi.fn(),
  recordFormFeedback: vi.fn(),
}));

// Mock logger
vi.mock("../../utils/logger", () => ({
  devLog: vi.fn(),
}));

describe("FeedbackModal UX Enhancements", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    user: { uid: "test-user", email: "test@example.com" },
  };

  it("should have accessibility attributes on type selector", () => {
    render(<FeedbackModal {...defaultProps} />);

    const group = screen.getByRole("group", { name: /feedback type/i });
    expect(group).toBeTruthy();

    const bugButton = screen.getByRole("button", { name: /bug report/i });
    expect(bugButton.getAttribute("aria-pressed")).toBe("true");

    const featureButton = screen.getByRole("button", { name: /feature request/i });
    expect(featureButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("should update aria-pressed when type changes", () => {
    render(<FeedbackModal {...defaultProps} />);

    const featureButton = screen.getByRole("button", { name: /feature request/i });
    fireEvent.click(featureButton);

    expect(featureButton.getAttribute("aria-pressed")).toBe("true");
    const bugButton = screen.getByRole("button", { name: /bug report/i });
    expect(bugButton.getAttribute("aria-pressed")).toBe("false");
  });

  it("should display character count for description", () => {
    render(<FeedbackModal {...defaultProps} />);

    const textarea = screen.getByLabelText(/describe the issue/i);
    fireEvent.change(textarea, { target: { value: "Hello world" } });

    expect(screen.getByText("11 characters")).toBeTruthy();
  });
});
