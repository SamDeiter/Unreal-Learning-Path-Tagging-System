/**
 * LessonWidget — smoke tests.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import LessonWidget from "./LessonWidget";

describe("LessonWidget", () => {
  it("renders empty-state copy when html is null", () => {
    render(<LessonWidget html={null} />);
    expect(screen.getByText(/Interactive demo unavailable/i)).toBeTruthy();
  });

  it("renders a sandboxed iframe when html is provided", () => {
    const html = "<!doctype html><html><body><p>hi</p></body></html>";
    const { container } = render(<LessonWidget html={html} />);
    const frame = container.querySelector("iframe");
    expect(frame).toBeTruthy();
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("srcdoc")).toBe(html);
  });
});
