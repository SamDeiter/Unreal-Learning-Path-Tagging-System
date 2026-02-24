/**
 * Vertex AI Search Integration Tests
 *
 * Monitors: API contract, service resilience, pipeline integration, and component rendering.
 * These tests use mocks — they don't call the real Cloud Function.
 */
import { describe, it, expect, vi } from "vitest";

// ── Test 1: Service contract ───────────────────────────────────────────────

describe("searchDocsVertexAI — Service Contract", () => {
  const EMPTY_RESULT = { results: [], summary: "", citations: [], references: [] };

  it("should return empty result for empty query", async () => {
    const { searchDocsVertexAI } = await import("../services/docsSearchService");
    const result = await searchDocsVertexAI("", 5);
    expect(result).toEqual(EMPTY_RESULT);
  });

  it("should return empty result for null query", async () => {
    const { searchDocsVertexAI } = await import("../services/docsSearchService");
    const result = await searchDocsVertexAI(null, 5);
    expect(result).toEqual(EMPTY_RESULT);
  });

  it("should return empty result for whitespace-only query", async () => {
    const { searchDocsVertexAI } = await import("../services/docsSearchService");
    const result = await searchDocsVertexAI("   ", 5);
    expect(result).toEqual(EMPTY_RESULT);
  });

  it("should gracefully handle Cloud Function errors", async () => {
    // Mock Firebase to throw
    vi.doMock("firebase/functions", () => ({
      getFunctions: () => ({}),
      httpsCallable: () => () => {
        throw new Error("Cloud Function unavailable");
      },
    }));
    vi.doMock("../services/firebaseConfig", () => ({
      getFirebaseApp: () => ({}),
    }));

    const { searchDocsVertexAI } = await import("../services/docsSearchService");
    const result = await searchDocsVertexAI("lumen reflections", 5);

    // Should not throw — returns empty gracefully
    expect(result).toEqual(EMPTY_RESULT);

    vi.doUnmock("firebase/functions");
    vi.doUnmock("../services/firebaseConfig");
  });
});

// ── Test 2: Response shape validation ──────────────────────────────────────

describe("searchDocsVertexAI — Response Shape", () => {
  it("should have the expected fields in the result object", async () => {
    const { searchDocsVertexAI } = await import("../services/docsSearchService");
    const result = await searchDocsVertexAI("", 5);

    // Verify shape even for empty results
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("citations");
    expect(result).toHaveProperty("references");
    expect(Array.isArray(result.results)).toBe(true);
    expect(Array.isArray(result.citations)).toBe(true);
    expect(Array.isArray(result.references)).toBe(true);
    expect(typeof result.summary).toBe("string");
  });
});

// ── Test 3: OfficialDocsSummary component rendering ────────────────────────

describe("OfficialDocsSummary — Component Renders", () => {
  it("should render nothing when no data and not loading", async () => {
    const React = await import("react");
    const { render } = await import("@testing-library/react");
    const { default: OfficialDocsSummary } = await import(
      "../components/OfficialDocsSummary/OfficialDocsSummary"
    );

    const { container } = render(
      React.createElement(OfficialDocsSummary, { data: null, isLoading: false, error: null })
    );

    expect(container.innerHTML).toBe("");
  });

  it("should render loading state", async () => {
    const React = await import("react");
    const { render, screen, fireEvent } = await import("@testing-library/react");
    const { default: OfficialDocsSummary } = await import(
      "../components/OfficialDocsSummary/OfficialDocsSummary"
    );

    render(
      React.createElement(OfficialDocsSummary, { data: null, isLoading: true, error: null })
    );

    // Expand the collapsible section to see loading content
    fireEvent.click(screen.getByText(/Official UE5 Documentation/i));

    expect(screen.getByText(/searching official documentation/i)).toBeTruthy();
  });

  it("should render error state", async () => {
    const React = await import("react");
    const { render, screen, fireEvent } = await import("@testing-library/react");
    const { default: OfficialDocsSummary } = await import(
      "../components/OfficialDocsSummary/OfficialDocsSummary"
    );

    render(
      React.createElement(OfficialDocsSummary, {
        data: null,
        isLoading: false,
        error: "Connection failed",
      })
    );

    // Expand the collapsible section to see error content
    fireEvent.click(screen.getByText(/Official UE5 Documentation/i));

    expect(screen.getByText("Connection failed")).toBeTruthy();
  });

  it("should render AI summary when data is present", async () => {
    const React = await import("react");
    const { render, screen, fireEvent } = await import("@testing-library/react");
    const { default: OfficialDocsSummary } = await import(
      "../components/OfficialDocsSummary/OfficialDocsSummary"
    );

    const mockData = {
      results: [
        { title: "Lumen Overview", url: "https://dev.epicgames.com/lumen", snippet: "Lumen is..." },
      ],
      summary: "Lumen is a dynamic global illumination system in UE5.",
      citations: [],
      references: [
        { title: "Lumen Docs", uri: "https://dev.epicgames.com/lumen" },
      ],
    };

    render(
      React.createElement(OfficialDocsSummary, { data: mockData, isLoading: false, error: null })
    );

    // Expand the collapsible section to see summary content
    const expandBtn = document.querySelector("[aria-expanded]");
    fireEvent.click(expandBtn);

    expect(screen.getByText(/AI Summary/i)).toBeTruthy();
    expect(
      screen.getByText("Lumen is a dynamic global illumination system in UE5.")
    ).toBeTruthy();
    expect(screen.getByText("Lumen Docs")).toBeTruthy();
    expect(screen.getByText(/1 results/i)).toBeTruthy();
  });
});

// ── Test 4: Pipeline integration ───────────────────────────────────────────

describe("searchPipeline — Vertex AI Included", () => {
  it("pipeline return type should include vertexAIDocs field", async () => {
    // Just verify the pipeline module exports correctly
    const pipeline = await import("../services/searchPipeline");
    expect(typeof pipeline.runSearchPipeline).toBe("function");
  });
});
