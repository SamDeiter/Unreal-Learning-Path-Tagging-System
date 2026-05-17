import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock must be at the very top level for hoisting to work correctly with imports
vi.mock("../../../utils/osUtils", () => ({
  MODIFIER_KEY: "MOD_KEY",
}));

// Now import the component that uses the mock
import ProblemInput from "../ProblemInput";

describe("ProblemInput Palette Enhancements", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders the character count with correct pluralization", () => {
    render(<ProblemInput onSubmit={() => {}} />);

    const textarea = screen.getByLabelText("Problem description");

    // 0 characters
    expect(screen.getByText(/0 characters/)).toBeTruthy();

    // 1 character
    fireEvent.change(textarea, { target: { value: "a" } });
    expect(screen.getByText(/1 character$/)).toBeTruthy();

    // 2 characters
    fireEvent.change(textarea, { target: { value: "ab" } });
    expect(screen.getByText(/2 characters/)).toBeTruthy();
  });

  it("renders keyboard hints with the MODIFIER_KEY", () => {
    render(<ProblemInput onSubmit={() => {}} />);

    // Keyboard hints are often split across elements (kbd, span, etc.)
    // We check for the presence of the pieces

    // Hint at the bottom: "Press MOD_KEY + Enter to submit"
    // It's inside a span, with MOD_KEY and Enter inside kbd tags
    const hintSpan = screen.getByText(/Press/).closest('.hint');
    expect(hintSpan.textContent).toContain("MOD_KEY");
    expect(hintSpan.textContent).toContain("Enter");
    expect(hintSpan.textContent).toContain("submit");

    // Drop prompts
    const prompts = screen.getAllByText(/Paste/);
    prompts.forEach(p => {
        expect(p.textContent).toContain("MOD_KEY+V");
    });
  });

  it("calls onSubmit when MODIFIER_KEY + Enter is pressed", () => {
    const handleSubmit = vi.fn();
    render(<ProblemInput onSubmit={handleSubmit} />);

    const textarea = screen.getByLabelText("Problem description");

    // Fill enough text to enable submit
    fireEvent.change(textarea, { target: { value: "This is a long enough problem description." } });

    // Ctrl+Enter
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(handleSubmit).toHaveBeenCalled();

    handleSubmit.mockClear();

    // Meta+Enter (Cmd+Enter)
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    expect(handleSubmit).toHaveBeenCalled();
  });

  it("has an aria-label on the history delete button", () => {
    // Mock localStorage for history
    const history = [{ query: "test query", cartId: null }];
    localStorage.setItem("fix-problem-history", JSON.stringify(history));

    render(<ProblemInput onSubmit={() => {}} />);

    const deleteBtn = screen.getByLabelText("Remove from history");
    expect(deleteBtn).toBeTruthy();
    expect(deleteBtn.getAttribute("title")).toBe("Remove");
  });
});
