/**
 * PathGapCard.test.jsx — Unit tests for PathGapCard component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PathGapCard from "../PathGapCard";

// Mock the gap analyzer service
vi.mock("../../../services/pathGapAnalyzer", () => ({
  simulatePersonaGaps: vi.fn(),
}));

import { simulatePersonaGaps } from "../../../services/pathGapAnalyzer";

const mockGaps = {
  coverageScore: 0.72,
  corpusStats: { subtopicsChecked: 10, subtopicsCovered: 7 },
  blindSpots: [
    {
      topic: "Niagara Particle System",
      severity: "high",
      reason: "Not covered in any corpus segment",
      researchContext: "Critical for visual effects pipeline",
    },
    {
      topic: "Sequencer Basics",
      severity: "medium",
      reason: "Only partially covered",
    },
  ],
  assumedKnowledge: ["C++ Fundamentals", "Blueprint Basics"],
  suggestions: [
    { topic: "Add Niagara tutorial", priority: "high", rationale: "Fills critical gap" },
    { topic: "Include debugging tips", priority: "low", rationale: "Nice to have" },
  ],
};

const mockPainPoints = [
  {
    painPoint: "Niagara GPU crashes on older hardware",
    sourceUrl: "https://forums.unrealengine.com/t/123",
    sourceTitle: "UE Forums",
  },
  {
    painPoint: "Sequencer keyframe confusion",
    sourceUrl: "https://forums.unrealengine.com/t/456",
  },
];

const mockSteps = [{ category: "fix", segment: { title: "Step 1" } }];

describe("PathGapCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when gaps is null", () => {
    const { container } = render(<PathGapCard gaps={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders compact view with coverage badge and issue count", () => {
    render(<PathGapCard gaps={mockGaps} communityPainPoints={mockPainPoints} />);

    const badge = screen.getByText("72% coverage");
    expect(badge).toBeTruthy();

    // 2 blind spots + 2 assumed knowledge = 4 issues
    expect(screen.getByText("4 issues")).toBeTruthy();
  });

  it("shows high coverage badge for >= 80%", () => {
    const highGaps = { ...mockGaps, coverageScore: 0.92 };
    render(<PathGapCard gaps={highGaps} />);
    const badge = screen.getByText("92% coverage");
    expect(badge.className).toContain("high");
  });

  it("shows medium coverage badge for 50-79%", () => {
    render(<PathGapCard gaps={mockGaps} />);
    const badge = screen.getByText("72% coverage");
    expect(badge.className).toContain("medium");
  });

  it("shows low coverage badge for < 50%", () => {
    const lowGaps = { ...mockGaps, coverageScore: 0.3 };
    render(<PathGapCard gaps={lowGaps} />);
    const badge = screen.getByText("30% coverage");
    expect(badge.className).toContain("low");
  });

  it("toggles expanded view on click", () => {
    render(<PathGapCard gaps={mockGaps} communityPainPoints={mockPainPoints} />);

    // Expanded content should not be visible initially
    expect(screen.queryByText("Blind Spots")).toBeNull();

    // Click toggle
    fireEvent.click(screen.getByText("🔍 Gap Analysis"));

    // Now sections should be visible
    expect(screen.getByText("📋 Blind Spots")).toBeTruthy();
    expect(screen.getByText("⚠️ Assumed Knowledge")).toBeTruthy();
    expect(screen.getByText("💡 Suggestions")).toBeTruthy();
    expect(screen.getByText("🌐 Community Pain Points")).toBeTruthy();
  });

  it("renders blind spots with severity dots", () => {
    render(<PathGapCard gaps={mockGaps} />);
    fireEvent.click(screen.getByText("🔍 Gap Analysis"));

    expect(screen.getByText("Niagara Particle System")).toBeTruthy();
    expect(screen.getByText("Sequencer Basics")).toBeTruthy();
  });

  it("renders assumed knowledge chips", () => {
    render(<PathGapCard gaps={mockGaps} />);
    fireEvent.click(screen.getByText("🔍 Gap Analysis"));

    expect(screen.getByText("C++ Fundamentals")).toBeTruthy();
    expect(screen.getByText("Blueprint Basics")).toBeTruthy();
  });

  it("renders suggestions with priority badges", () => {
    render(<PathGapCard gaps={mockGaps} />);
    fireEvent.click(screen.getByText("🔍 Gap Analysis"));

    expect(screen.getByText("Add Niagara tutorial")).toBeTruthy();
    expect(screen.getByText("Include debugging tips")).toBeTruthy();
  });

  it("renders community pain points with links", () => {
    render(<PathGapCard gaps={mockGaps} communityPainPoints={mockPainPoints} />);
    fireEvent.click(screen.getByText("🔍 Gap Analysis"));

    expect(screen.getByText("Niagara GPU crashes on older hardware")).toBeTruthy();
    const link = screen.getByText("UE Forums");
    expect(link.getAttribute("href")).toBe("https://forums.unrealengine.com/t/123");
  });

  it("calls onFillGap when Fill This Gap button is clicked", async () => {
    const onFillGap = vi.fn().mockResolvedValue(undefined);
    render(<PathGapCard gaps={mockGaps} onFillGap={onFillGap} />);
    fireEvent.click(screen.getByText("🔍 Gap Analysis"));

    const fillBtns = screen.getAllByText("Fill This Gap");
    fireEvent.click(fillBtns[0]);

    await waitFor(() => {
      expect(onFillGap).toHaveBeenCalledWith("Niagara Particle System");
    });
  });

  it("calls onExplore when Explore button is clicked", () => {
    const onExplore = vi.fn();
    render(<PathGapCard gaps={mockGaps} onExplore={onExplore} />);
    fireEvent.click(screen.getByText("🔍 Gap Analysis"));

    const exploreBtns = screen.getAllByText("Explore");
    fireEvent.click(exploreBtns[0]);

    expect(onExplore).toHaveBeenCalledWith("Niagara Particle System");
  });

  it("calls simulatePersonaGaps when persona is changed", async () => {
    const personaResult = {
      coverageScore: 0.5,
      blindSpots: [{ topic: "Everything", severity: "high", reason: "Beginner" }],
      assumedKnowledge: [],
      suggestions: [],
    };
    simulatePersonaGaps.mockResolvedValue(personaResult);

    render(<PathGapCard gaps={mockGaps} query="test query" steps={mockSteps} />);
    fireEvent.click(screen.getByText("🔍 Gap Analysis"));

    // Change persona
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "beginner" } });

    await waitFor(() => {
      expect(simulatePersonaGaps).toHaveBeenCalledWith("test query", mockSteps, "beginner");
    });

    // Coverage should update
    await waitFor(() => {
      expect(screen.getByText("50% coverage")).toBeTruthy();
    });
  });

  it("handles empty blind spots gracefully", () => {
    const emptyGaps = { ...mockGaps, blindSpots: [], assumedKnowledge: [], suggestions: [] };
    render(<PathGapCard gaps={emptyGaps} />);
    fireEvent.click(screen.getByText("🔍 Gap Analysis"));

    // Should not render these sections
    expect(screen.queryByText("📋 Blind Spots")).toBeNull();
    expect(screen.queryByText("⚠️ Assumed Knowledge")).toBeNull();
    expect(screen.queryByText("💡 Suggestions")).toBeNull();
  });
});
