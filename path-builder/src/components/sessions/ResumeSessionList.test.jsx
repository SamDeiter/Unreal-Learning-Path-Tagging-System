/**
 * ResumeSessionList — Unit tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockUseSessions = vi.fn();
vi.mock("../../hooks/useSessions", () => ({
  default: (...args) => mockUseSessions(...args),
}));

import ResumeSessionList from "./ResumeSessionList";

function session(over = {}) {
  return {
    id: "s1",
    uid: "u",
    mode: "problem-first",
    query: "Lumen flickers on reflections",
    conversationHistory: [],
    result: null,
    createdAt: Date.now() - 10 * 60_000,
    updatedAt: Date.now() - 5 * 60_000,
    ...over,
  };
}

describe("ResumeSessionList", () => {
  beforeEach(() => {
    mockUseSessions.mockReset();
  });

  it("renders empty state when no sessions", () => {
    mockUseSessions.mockReturnValue({ sessions: [], loading: false, error: null });
    render(<ResumeSessionList onResume={() => {}} />);
    expect(screen.getByText(/no prior sessions/i)).toBeTruthy();
  });

  it("renders loading state", () => {
    mockUseSessions.mockReturnValue({ sessions: [], loading: true, error: null });
    render(<ResumeSessionList onResume={() => {}} />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it("renders list items with query preview, mode badge, and relative time", () => {
    const s = session({ query: "Nanite mesh disappears at distance" });
    mockUseSessions.mockReturnValue({ sessions: [s], loading: false, error: null });
    render(<ResumeSessionList onResume={() => {}} />);
    expect(screen.getByText(/nanite mesh disappears at distance/i)).toBeTruthy();
    expect(screen.getByText("Fix")).toBeTruthy(); // mode badge for problem-first
    expect(screen.getByText(/ago|now/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /resume/i })).toBeTruthy();
  });

  it("calls onResume with the session when Resume is clicked", () => {
    const s = session();
    const onResume = vi.fn();
    mockUseSessions.mockReturnValue({ sessions: [s], loading: false, error: null });
    render(<ResumeSessionList onResume={onResume} />);
    fireEvent.click(screen.getByRole("button", { name: /resume/i }));
    expect(onResume).toHaveBeenCalledWith(s);
  });

  it("highlights currentSessionId and disables its Resume button (shows 'Current')", () => {
    const s = session({ id: "current-1" });
    mockUseSessions.mockReturnValue({ sessions: [s], loading: false, error: null });
    render(<ResumeSessionList onResume={() => {}} currentSessionId="current-1" />);
    const btn = screen.getByRole("button", { name: /current/i });
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/current/i);
  });

  it("labels goal-build sessions as 'Goal'", () => {
    mockUseSessions.mockReturnValue({
      sessions: [session({ mode: "goal-build" })],
      loading: false,
      error: null,
    });
    render(<ResumeSessionList onResume={() => {}} />);
    expect(screen.getByText("Goal")).toBeTruthy();
  });
});
