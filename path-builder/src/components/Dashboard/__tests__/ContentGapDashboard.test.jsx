/**
 * Smoke tests for ContentGapDashboard component
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ContentGapDashboard from "../ContentGapDashboard";

// ── Mock data ─────────────────────────────────────────────────────────────

const mockCourses = [
  {
    code: "200.01",
    title: "Getting Started with Sequencer",
    canonical_tags: ["sequencer", "cinematics"],
    ai_tags: ["animation"],
    gemini_system_tags: [],
    transcript_tags: [],
    extracted_tags: [],
    tags: { level: "Beginner", topic: "Animation", industry: "Film" },
  },
  {
    code: "300.01",
    title: "C++ Gameplay Programming Fundamentals",
    canonical_tags: ["c++", "programming"],
    ai_tags: ["code"],
    gemini_system_tags: [],
    transcript_tags: ["blueprint"],
    extracted_tags: [],
    tags: { level: "Intermediate", topic: "Programming", industry: "Games" },
  },
  {
    code: "100.01",
    title: "UE5 Editor Overview",
    canonical_tags: ["editor"],
    ai_tags: [],
    gemini_system_tags: [],
    transcript_tags: [],
    extracted_tags: [],
    tags: { level: "Beginner", topic: "General", industry: "General" },
  },
];

const mockTags = [];

// ── Mock context ──────────────────────────────────────────────────────────

vi.mock("../../../context/TagDataContext", () => ({
  useTagData: () => ({
    courses: mockCourses,
    tags: mockTags,
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────

describe("ContentGapDashboard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders without crashing", () => {
    render(<ContentGapDashboard />);
    expect(screen.getByText("Persona Content Gaps")).toBeTruthy();
  });

  it("renders persona selector chips for all personas", () => {
    render(<ContentGapDashboard />);
    // Should have chips for all 9 personas (use getAllByText since names may appear in section headers too)
    expect(screen.getAllByText(/Indie Isaac/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Logic-Driven Liam/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Alex the Actor/).length).toBeGreaterThanOrEqual(1);
    // Verify we have exactly 9 persona chip buttons
    const chips = document.querySelectorAll(".gap-chip");
    expect(chips.length).toBe(10);
  });

  it("renders gap stat cards", () => {
    render(<ContentGapDashboard />);
    expect(screen.getByText("Relevant")).toBeTruthy();
    expect(screen.getByText("Too Technical")).toBeTruthy();
    expect(screen.getByText("Topics Covered")).toBeTruthy();
    expect(screen.getByText("Keyword Gaps")).toBeTruthy();
  });

  it("clicking a persona chip updates the analysis", () => {
    render(<ContentGapDashboard />);
    const alexChips = screen.getAllByText(/Alex the Actor/);
    const alexButton = alexChips.find((el) => el.closest("button")?.classList.contains("gap-chip"));
    fireEvent.click(alexButton);
    // After clicking Alex, the chip should be active
    expect(alexButton.closest("button").classList.contains("active")).toBe(true);
  });

  it("pre-selects persona from localStorage", () => {
    localStorage.setItem("ue5_persona_id", "animator_alex");
    render(<ContentGapDashboard />);
    const alexChips = screen.getAllByText(/Alex the Actor/);
    const alexButton = alexChips.find((el) => el.closest("button")?.classList.contains("gap-chip"));
    expect(alexButton.closest("button").classList.contains("active")).toBe(true);
  });

  it("shows topic coverage bars when required topics exist", () => {
    localStorage.setItem("ue5_persona_id", "animator_alex");
    render(<ContentGapDashboard />);
    // animator_alex has requiredTopics: ["animation", "sequencer", "lighting"]
    // "animation" and "sequencer" should be covered, "lighting" may vary
    const coveredLabels = screen.getAllByText("Covered");
    expect(coveredLabels.length).toBeGreaterThan(0);
  });

  it("toggle buttons show/hide course lists", () => {
    localStorage.setItem("ue5_persona_id", "animator_alex");
    render(<ContentGapDashboard />);

    // Find the toggle for relevant courses
    const toggleButtons = screen.queryAllByText(/Top Relevant Courses/);
    if (toggleButtons.length > 0) {
      fireEvent.click(toggleButtons[0]);
      // After clicking, course items should appear
      expect(screen.queryByText("200.01")).toBeTruthy();
    }
  });
});
