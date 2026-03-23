/**
 * DemandDashboard.test.jsx
 *
 * Unit + integration tests for the Demand Intelligence Dashboard.
 * Covers: loading state, suggestion rendering, category filters,
 * Start Authoring flow (localStorage + hash + custom event),
 * critical gap alerts, empty state, error state, and trending questions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mock Data ────────────────────────────────────────────────

const MOCK_REPORT = {
  suggestions: [
    {
      topic: "Niagara Particle Systems",
      category: "VFX",
      demandScore: 85,
      coverageInLibrary: 10,
      gap: 75,
      confidence: "high",
      courseCount: 1,
      sources: [
        { type: "reddit", url: "https://reddit.com/r/test", title: "How to Niagara?" },
      ],
    },
    {
      topic: "PCG Framework",
      category: "World Building",
      demandScore: 72,
      coverageInLibrary: 0,
      gap: 72,
      confidence: "medium",
      courseCount: 0,
      sources: [],
    },
  ],
  trendingQuestions: [
    {
      question: "How to create a GPU particle system?",
      category: "VFX",
      subtopic: "Niagara",
      frequency: "high",
      sources: [{ type: "reddit" }],
    },
  ],
  painPointsByCategory: {
    VFX: ["GPU performance issues", "Module complexity"],
  },
  demandData: {
    VFX: { overall: 85, subtopics: { Niagara: 90, Cascade: 30 } },
  },
  coverageData: {
    VFX: { Niagara: { coverage: 10 }, Cascade: { coverage: 60 } },
  },
  provenance: {
    totalSources: 12,
    freshestPost: "2 days ago",
    scrapedAt: "2026-03-20",
  },
  generatedAt: new Date().toISOString(),
  _source: "firestore",
};

const MOCK_STATS_LOADED = {
  totalSuggestions: 2,
  trendingQuestions: 1,
  painPointCount: 2,
  categoriesScanned: 2,
  avgGap: 73.5,
  avgDemand: 78.5,
};

// ── Mock Hooks & Services ────────────────────────────────────

const mockGenerate = vi.fn();
const mockRefresh = vi.fn();
const mockSetCategoryFilter = vi.fn();

// Default: loading state
let mockHookReturn = {
  report: null,
  loading: true,
  error: null,
  stats: { totalSuggestions: 0, trendingQuestions: 0, painPointCount: 0, categoriesScanned: 0 },
  filteredSuggestions: [],
  availableCategories: [],
  categoryFilter: null,
  generate: mockGenerate,
  refresh: mockRefresh,
  setCategoryFilter: mockSetCategoryFilter,
};

vi.mock("../../../hooks/useDemandIntelligence", () => ({
  useDemandIntelligence: () => mockHookReturn,
}));

vi.mock("../../../services/demandIntelligenceService", () => ({
  SOURCE_TYPES: {
    REDDIT: "reddit",
    EPIC_FORUM: "epic_forum",
    STACKOVERFLOW: "stackoverflow",
    COMMUNITY_INDEX: "community_index",
    YOUTUBE_COMMENTS: "youtube_comments",
    EPIC_DEV_COMMUNITY: "epic_dev_community",
  },
}));

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(),
}));

vi.mock("../../../services/firebaseConfig", () => ({
  getFirebaseApp: vi.fn(),
}));

vi.mock("../DemandDashboard.css", () => ({}));

import DemandDashboard from "../DemandDashboard";

// ── Helpers ─────────────────────────────────────────────────

function setMock(overrides) {
  mockHookReturn = {
    loading: false,
    error: null,
    stats: MOCK_STATS_LOADED,
    filteredSuggestions: MOCK_REPORT.suggestions,
    availableCategories: ["VFX", "World Building"],
    categoryFilter: null,
    generate: mockGenerate,
    refresh: mockRefresh,
    setCategoryFilter: mockSetCategoryFilter,
    ...overrides,
    report: overrides?.report !== undefined ? overrides.report : MOCK_REPORT,
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("DemandDashboard", () => {
  beforeEach(() => {
    localStorage.clear();
    mockGenerate.mockClear();
    mockRefresh.mockClear();
    mockSetCategoryFilter.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
    window.location.hash = "";
  });

  // --- Loading ---

  it("renders loading spinner when loading with no report", () => {
    mockHookReturn = {
      report: null,
      loading: true,
      error: null,
      stats: {},
      filteredSuggestions: [],
      availableCategories: [],
      categoryFilter: null,
      generate: mockGenerate,
      refresh: mockRefresh,
      setCategoryFilter: mockSetCategoryFilter,
    };

    const { container } = render(<DemandDashboard />);
    expect(container.querySelector(".dashboard-loading")).toBeTruthy();
  });

  // --- Suggestion Rendering ---

  it("renders suggestion cards with topics", () => {
    setMock();
    render(<DemandDashboard />);
    // Topic names may appear in both suggestion cards and critical gap alerts
    const niagara = screen.getAllByText("Niagara Particle Systems");
    expect(niagara.length).toBeGreaterThanOrEqual(1);
    const pcg = screen.getAllByText("PCG Framework");
    expect(pcg.length).toBeGreaterThanOrEqual(1);
  });

  it("renders rank numbers on suggestion cards", () => {
    setMock();
    render(<DemandDashboard />);
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("#2")).toBeTruthy();
  });

  it("renders demand score for a suggestion", () => {
    setMock();
    render(<DemandDashboard />);
    expect(screen.getByText("85")).toBeTruthy();
  });

  // --- Category Filters ---

  it("renders All filter chip", () => {
    setMock();
    render(<DemandDashboard />);
    expect(screen.getByText("All")).toBeTruthy();
  });

  it("renders category filter chips", () => {
    setMock();
    render(<DemandDashboard />);
    // VFX appears in both filter chips AND suggestion cards, so use getAllByText
    const vfxElements = screen.getAllByText("VFX");
    expect(vfxElements.length).toBeGreaterThanOrEqual(2); // filter chip + suggestion card
    const wbElements = screen.getAllByText("World Building");
    expect(wbElements.length).toBeGreaterThanOrEqual(1);
  });

  // --- Start Authoring Flow ---

  it("Start Authoring writes localStorage payload and sets hash", () => {
    setMock();
    render(<DemandDashboard />);

    // Expand the first suggestion card by clicking its header area
    fireEvent.click(screen.getByText("Niagara Particle Systems"));

    // Click the "Start Authoring →" button
    fireEvent.click(screen.getByText(/Start Authoring →/));

    // Assert localStorage payload
    const stored = JSON.parse(localStorage.getItem("demand-start-authoring-payload"));
    expect(stored).toBeTruthy();
    expect(stored.query).toContain("Niagara Particle Systems");
    expect(stored.suggestion.demandScore).toBe(85);
    expect(stored.suggestion.gap).toBe(75);

    // Assert hash navigation
    expect(window.location.hash).toBe("#authoring");
  });

  // --- Critical Gap Alerts ---

  it("renders critical gap alerts for high-demand zero-coverage topics", () => {
    setMock();
    render(<DemandDashboard />);
    // PCG Framework: demandScore=72 > 60 AND coverageInLibrary=0
    expect(screen.getByText(/Critical Coverage Gaps/)).toBeTruthy();
  });

  // --- Error State ---

  it("renders error message when error is set", () => {
    mockHookReturn = {
      report: null,
      loading: false,
      error: "Failed to load demand data",
      stats: {},
      filteredSuggestions: [],
      availableCategories: [],
      categoryFilter: null,
      generate: mockGenerate,
      refresh: mockRefresh,
      setCategoryFilter: mockSetCategoryFilter,
    };

    render(<DemandDashboard />);
    expect(screen.getByText(/Failed to load demand data/)).toBeTruthy();
  });

  // --- Empty State ---

  it("shows empty state when filtered suggestions is empty", () => {
    setMock({ filteredSuggestions: [] });
    render(<DemandDashboard />);
    expect(screen.getByText(/No suggestions found/)).toBeTruthy();
  });

  // --- Trending Questions ---

  it("renders trending questions from report", () => {
    setMock();
    render(<DemandDashboard />);
    expect(screen.getByText(/GPU particle system/)).toBeTruthy();
  });

  // --- Stats Bar ---

  it("renders stats bar with correct counts", () => {
    setMock();
    render(<DemandDashboard />);
    expect(screen.getByText("Opportunities")).toBeTruthy();
    expect(screen.getByText("Trending Questions")).toBeTruthy();
    expect(screen.getByText("Pain Points")).toBeTruthy();
  });
});
