import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AccessibilityPanel from "../AccessibilityPanel";

// Mock the hook
vi.mock("../../../hooks/useAccessibilityPreferences", () => ({
  default: () => ({
    prefs: { dyslexicFont: false, reducedMotion: "system", readingLevel: "standard" },
    setDyslexicFont: vi.fn(),
    setReducedMotion: vi.fn(),
    setReadingLevel: vi.fn(),
  }),
}));

describe("AccessibilityPanel", () => {
  it("renders trigger button", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByLabelText("Accessibility settings");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("opens popover on click and has correct ARIA attributes", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByLabelText("Accessibility settings");
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Accessibility")).toBeInTheDocument();
  });

  it("closes on Escape key", () => {
    render(<AccessibilityPanel />);
    fireEvent.click(screen.getByLabelText("Accessibility settings"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returns focus to trigger when closed via Escape", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByLabelText("Accessibility settings");

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    expect(document.activeElement).toBe(trigger);
  });

  it("returns focus to trigger when closed via Close button", () => {
    render(<AccessibilityPanel />);
    const trigger = screen.getByLabelText("Accessibility settings");

    fireEvent.click(trigger);
    const closeBtn = screen.getByLabelText("Close");
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
