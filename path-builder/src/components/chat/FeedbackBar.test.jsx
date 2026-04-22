/**
 * FeedbackBar — Unit tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSubmit = vi.fn();
const mockUseFeedback = vi.fn(() => ({
  submit: mockSubmit,
  loading: false,
  error: null,
  lastSignal: {},
}));

vi.mock("../../hooks/useFeedback", () => ({
  default: (...args) => mockUseFeedback(...args),
}));

import FeedbackBar from "./FeedbackBar";

describe("FeedbackBar", () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockUseFeedback.mockReset();
    mockUseFeedback.mockReturnValue({
      submit: mockSubmit,
      loading: false,
      error: null,
      lastSignal: {},
    });
  });

  it("renders nothing when sessionId is missing", () => {
    const { container } = render(<FeedbackBar sessionId={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all four signal chips", () => {
    render(<FeedbackBar sessionId="sess_1" />);
    expect(screen.getByRole("button", { name: "Helpful" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Already knew this" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confused" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Not helpful" })).toBeTruthy();
  });

  it("calls submit with correct signal + tagsTouched and fires onSubmitted", async () => {
    mockSubmit.mockResolvedValue({ ok: true, feedbackId: "fb_1" });
    const onSubmitted = vi.fn();
    render(
      <FeedbackBar
        sessionId="sess_1"
        tagsTouched={["tag_a"]}
        onSubmitted={onSubmitted}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        sessionId: "sess_1",
        signal: "helpful",
        tagsTouched: ["tag_a"],
      });
    });
    await waitFor(() => {
      expect(onSubmitted).toHaveBeenCalledWith("helpful");
    });
  });

  it("shows confirmation and disables chips after successful submit", async () => {
    mockSubmit.mockResolvedValue({ ok: true, feedbackId: "fb_1" });
    render(<FeedbackBar sessionId="sess_1" />);

    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));

    await waitFor(() => {
      expect(screen.getByText(/thanks — noted\./i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Helpful" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Confused" }).disabled).toBe(true);
  });

  it("shows error message with retry when submit fails", async () => {
    mockSubmit.mockResolvedValue({ ok: false, error: "boom" });
    render(<FeedbackBar sessionId="sess_1" />);

    fireEvent.click(screen.getByRole("button", { name: "Not helpful" }));

    await waitFor(() => {
      expect(screen.getByText(/couldn't record that/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });
});
