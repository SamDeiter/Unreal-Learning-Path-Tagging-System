/**
 * useProblemFirst.sessionId.test.js — Focused tests for sessionId plumbing.
 *
 * Verifies:
 *   - sessionId forwarded in httpsCallable payload on follow-up turns
 *   - sessionId updated from response
 *   - handleReset clears sessionId
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────

const mockCallable = vi.fn();
const mockHttpsCallable = vi.fn(() => mockCallable);

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => ({ __functions: true })),
  httpsCallable: (...a) => mockHttpsCallable(...a),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
}));

vi.mock("../../services/firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "test-app" })),
}));

vi.mock("../../domain/courseMatching", () => ({
  matchCoursesToCart: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../../domain/videoRanking", () => ({
  flattenCoursesToVideos: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../../services/PathBuilder", () => ({
  buildLearningPath: vi.fn(() => ({ path: [] })),
}));

vi.mock("../../services/segmentSearchService", () => ({
  searchSegmentsHybrid: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../../services/docsSearchService", () => ({
  searchDocsSemantic: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../../services/analyticsService", () => ({
  trackQuerySubmitted: vi.fn(() => Promise.resolve()),
  trackDiagnosisGenerated: vi.fn(() => Promise.resolve()),
  trackLearningPathGenerated: vi.fn(() => Promise.resolve()),
}));

vi.mock("../useVideoCart", () => ({
  useVideoCart: () => ({
    cart: [],
    addToCart: vi.fn(),
    removeFromCart: vi.fn(),
    clearCart: vi.fn(),
    isInCart: vi.fn(() => false),
  }),
}));

vi.mock("../useSearchSubmit", () => ({
  useCourses: () => [],
}));

vi.mock("../useVideoActions", () => ({
  useVideoActions: () => ({
    handleVideoToggle: vi.fn(),
    handleWatchPath: vi.fn(),
  }),
}));

vi.mock("../../services/searchPipeline", () => ({
  runSearchPipeline: vi.fn(() =>
    Promise.resolve({
      semanticResults: [],
      retrievedPassages: [],
      vertexAIDocs: null,
    })
  ),
}));

vi.mock("../../services/blendedPathBuilder", () => ({
  buildBlendedPathFromDiagnosis: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("../../services/courseToVideos", () => ({
  matchAndFlattenToVideos: vi.fn(() =>
    Promise.resolve({
      matchedCourses: [],
      driveVideos: [{ id: "v1", title: "t" }], // non-empty to avoid no-results branch
      nonVideoItems: [],
      allItems: [{ id: "v1" }],
    })
  ),
}));

vi.mock("../../domain/constants", () => ({
  PROBLEM_STOPWORDS: new Set(),
}));

vi.mock("../../utils/logger", () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
}));

import useProblemFirst from "../useProblemFirst";

describe("useProblemFirst — sessionId plumbing", () => {
  beforeEach(() => {
    mockCallable.mockReset();
    mockHttpsCallable.mockClear();
  });

  it("updates sessionId from response, then forwards it on follow-up turns", async () => {
    // First call: no sessionId inbound, backend returns sessionId=sess-1
    mockCallable.mockResolvedValueOnce({
      data: {
        success: true,
        responseType: "ANSWER",
        mostLikelyCause: "Lumen temporal reset",
        confidence: "high",
        fastChecks: [],
        fixSteps: [],
        ifStillBrokenBranches: [],
        whyThisResult: [],
        evidence: [],
        cart: { diagnosis: {}, objectives: [], intent: {} },
        sessionId: "sess-1",
      },
    });

    const { result } = renderHook(() => useProblemFirst());

    await act(async () => {
      await result.current.handleSubmit({
        query: "Lumen flicker",
        detectedTagIds: [],
      });
    });

    // First call should NOT carry a sessionId
    expect(mockCallable).toHaveBeenCalledTimes(1);
    expect(mockCallable.mock.calls[0][0].sessionId).toBeNull();

    await waitFor(() => expect(result.current.sessionId).toBe("sess-1"));

    // Second call: the hook should forward sess-1
    mockCallable.mockResolvedValueOnce({
      data: {
        success: true,
        responseType: "ANSWER",
        mostLikelyCause: "Follow-up",
        confidence: "med",
        fastChecks: [],
        fixSteps: [],
        ifStillBrokenBranches: [],
        whyThisResult: [],
        evidence: [],
        cart: { diagnosis: {}, objectives: [], intent: {} },
        sessionId: "sess-1",
      },
    });

    await act(async () => {
      await result.current.handleSubmit({
        query: "Follow-up about nanite",
        detectedTagIds: [],
      });
    });

    expect(mockCallable).toHaveBeenCalledTimes(2);
    expect(mockCallable.mock.calls[1][0].sessionId).toBe("sess-1");
  });

  it("resets sessionId to null on handleReset", async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        success: true,
        responseType: "ANSWER",
        mostLikelyCause: "x",
        confidence: "med",
        fastChecks: [],
        fixSteps: [],
        ifStillBrokenBranches: [],
        whyThisResult: [],
        evidence: [],
        cart: { diagnosis: {}, objectives: [], intent: {} },
        sessionId: "sess-42",
      },
    });

    const { result } = renderHook(() => useProblemFirst());

    await act(async () => {
      await result.current.handleSubmit({ query: "q", detectedTagIds: [] });
    });
    await waitFor(() => expect(result.current.sessionId).toBe("sess-42"));

    act(() => {
      result.current.handleReset();
    });

    expect(result.current.sessionId).toBeNull();
    expect(result.current.messages).toEqual([]);
  });
});
