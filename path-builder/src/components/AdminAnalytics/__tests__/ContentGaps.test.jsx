/**
 * ContentGaps.test.jsx — Smoke test for the Content Gaps dashboard.
 * Verifies the component renders without crashing and shows expected UI.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ContentGaps from "../ContentGaps";

// Mock analyticsService (used for EVENTS import)
vi.mock("../../../services/analyticsService", () => ({
  EVENTS: {
    AI_COVERAGE_REPORT: "ai_coverage_report",
  },
}));

describe("ContentGaps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dashboard title", () => {
    render(<ContentGaps events={[]} />);
    expect(screen.getByText(/Content Gap Intelligence/)).toBeTruthy();
  });

  it("shows empty state when no events provided", () => {
    render(<ContentGaps events={[]} />);
    expect(screen.getByText(/No gap data yet/)).toBeTruthy();
  });

  it("renders stat cards when coverage events exist", () => {
    const mockEvents = [
      {
        event: "ai_coverage_report",
        query_preview: "time dilation UE5",
        learner_level: "intermediate",
        knowledge_gaps: ["time dilation", "physics simulation"],
        total_steps: 4,
        corpus_steps: 1,
        ai_generated_steps: 3,
        ai_ratio: 0.75,
        low_corpus_coverage: true,
        client_timestamp: "2026-03-08T12:00:00Z",
      },
    ];
    render(<ContentGaps events={mockEvents} />);
    expect(screen.getByText(/AI Fill Rate/)).toBeTruthy();
    expect(screen.getByText(/Paths Analyzed/)).toBeTruthy();
  });
});
