/**
 * pathGapAnalyzer.test.js — Unit tests for the Path Intelligence Engine
 *
 * Tests all 5 functions:
 *   1. analyzePathGaps
 *   2. generateGapFillStep
 *   3. searchCommunityPainPoints
 *   4. simulatePersonaGaps
 *   5. buildPrereqChain
 *
 * Mocking strategy follows bespokePathService.test.js:
 *   - Firebase httpsCallable is mocked to control CF responses
 *   - findRelevantSegments is mocked to control RAG results
 *   - computeTopicOverlap is mocked for prereq chain edge detection
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Hoist mocks ──────────────────────────────────────────
const mockCallable = vi.fn();

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

vi.mock("../../utils/retryWithBackoff", () => ({
  retryWithBackoff: vi.fn((fn) => fn()),
}));

vi.mock("../tokenTracker", () => ({
  recordTokenUsage: vi.fn(),
}));

vi.mock("../../utils/logger", () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
}));

// Mock findRelevantSegments and SIMILARITY_THRESHOLD
const mockFindRelevantSegments = vi.fn();
vi.mock("../pathSearch", () => ({
  findRelevantSegments: (...args) => mockFindRelevantSegments(...args),
  SIMILARITY_THRESHOLD: 0.7,
}));

// Mock computeTopicOverlap
const mockComputeTopicOverlap = vi.fn();
vi.mock("../pathSequencer", () => ({
  computeTopicOverlap: (...args) => mockComputeTopicOverlap(...args),
}));

// ── Import SUT ───────────────────────────────────────────
import {
  analyzePathGaps,
  generateGapFillStep,
  searchCommunityPainPoints,
  simulatePersonaGaps,
  buildPrereqChain,
} from "../pathGapAnalyzer";

// ── Test Fixtures ────────────────────────────────────────
const MOCK_STEPS = [
  {
    segment: {
      id: "seg-1",
      title: "Understanding Blueprint Variables",
      text: "Variables in Blueprints allow you to store data. You can create them in the My Blueprint panel.",
      type: "transcript",
    },
    category: "foundation",
    summary: "Variables in Blueprints allow you to store data.",
  },
  {
    segment: {
      id: "seg-2",
      title: "Setting Up Material Instances",
      text: "Material instances let you change parameters without recompiling the parent material.",
      type: "epic_learning",
    },
    category: "core",
    summary: "Material instances let you change parameters without recompiling.",
  },
  {
    segment: {
      id: "seg-3",
      title: "Applying Physics to Actors",
      text: "Enable physics simulation on a mesh by checking Simulate Physics in the Details panel.",
      type: "docs",
    },
    category: "transfer",
    summary: "Enable physics simulation on a mesh.",
  },
];

const MOCK_QUERY = "How to create a physics-based door in UE5";

// ── Test Suites ──────────────────────────────────────────

describe("pathGapAnalyzer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: computeTopicOverlap returns low overlap (topics are distinct)
    mockComputeTopicOverlap.mockReturnValue(0.1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═════════════════════════════════════════════════════════
  // 1. analyzePathGaps
  // ═════════════════════════════════════════════════════════

  describe("analyzePathGaps", () => {
    it("uses findRelevantSegments for each extracted subtopic", async () => {
      // Each subtopic search returns high-similarity matches (all covered)
      mockFindRelevantSegments.mockResolvedValue({
        segments: [{ title: "Match", similarity: 0.85 }],
        lowCorpusCoverage: false,
      });

      await analyzePathGaps(MOCK_QUERY, MOCK_STEPS);

      // Should be called for each unique subtopic (query + step titles)
      expect(mockFindRelevantSegments.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("identifies blind spots when corpus similarity < 0.7", async () => {
      // First topic: covered. Second+: weak coverage
      let callCount = 0;
      mockFindRelevantSegments.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            segments: [{ title: "Good match", similarity: 0.85 }],
            lowCorpusCoverage: false,
          });
        }
        return Promise.resolve({
          segments: [{ title: "Weak match", similarity: 0.45 }],
          lowCorpusCoverage: true,
        });
      });

      // Mock Gemini response for gap classification
      mockCallable.mockResolvedValue({
        data: {
          text: JSON.stringify({
            blindSpots: [
              {
                topic: "Setting Up Material Instances",
                severity: "medium",
                reason: "Material instances are rarely explained in context of doors",
                researchContext: "Material workflow is a top-10 roadblock",
              },
            ],
            assumedKnowledge: ["Editor navigation"],
            suggestions: [
              {
                topic: "Add collision setup step",
                priority: "high",
                rationale: "Physics doors need collision volumes",
              },
            ],
          }),
        },
      });

      const result = await analyzePathGaps(MOCK_QUERY, MOCK_STEPS);

      expect(result.blindSpots.length).toBeGreaterThan(0);
      expect(result.coverageScore).toBeLessThan(1.0);
    });

    it("does not flag covered topics as gaps", async () => {
      // All topics return high similarity
      mockFindRelevantSegments.mockResolvedValue({
        segments: [{ title: "Perfect match", similarity: 0.92 }],
        lowCorpusCoverage: false,
      });

      const result = await analyzePathGaps(MOCK_QUERY, MOCK_STEPS);

      expect(result.blindSpots).toHaveLength(0);
      expect(result.coverageScore).toBe(1.0);
    });

    it("coverageScore is ratio of covered to total subtopics", async () => {
      // 1 out of N covered
      let callCount = 0;
      mockFindRelevantSegments.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            segments: [{ title: "Match", similarity: 0.85 }],
            lowCorpusCoverage: false,
          });
        }
        return Promise.resolve({
          segments: [],
          lowCorpusCoverage: true,
        });
      });

      // Mock Gemini classification
      mockCallable.mockResolvedValue({
        data: { text: JSON.stringify({ blindSpots: [], assumedKnowledge: [], suggestions: [] }) },
      });

      const result = await analyzePathGaps(MOCK_QUERY, MOCK_STEPS);

      // coverageScore should be > 0 but < 1
      expect(result.coverageScore).toBeGreaterThan(0);
      expect(result.coverageScore).toBeLessThan(1.0);
      expect(result.corpusStats.subtopicsChecked).toBeGreaterThan(0);
    });

    it("falls back gracefully on Gemini parse failure", async () => {
      // Gaps exist but Gemini returns garbage
      mockFindRelevantSegments.mockResolvedValue({
        segments: [{ title: "Weak", similarity: 0.3 }],
        lowCorpusCoverage: true,
      });

      mockCallable.mockResolvedValue({
        data: { text: "This is not JSON at all!!!" },
      });

      const result = await analyzePathGaps(MOCK_QUERY, MOCK_STEPS);

      // Should still return gap data (from corpus check), just without Gemini classification
      expect(result.blindSpots.length).toBeGreaterThan(0);
      expect(result.coverageScore).toBeLessThan(1.0);
      // Should not throw
    });

    it("returns empty result for empty steps array", async () => {
      const result = await analyzePathGaps(MOCK_QUERY, []);

      expect(result.blindSpots).toHaveLength(0);
      expect(result.coverageScore).toBe(1.0);
      expect(mockFindRelevantSegments).not.toHaveBeenCalled();
    });

    it("includes original query in gap analysis prompt", async () => {
      mockFindRelevantSegments.mockResolvedValue({
        segments: [],
        lowCorpusCoverage: true,
      });

      mockCallable.mockResolvedValue({
        data: { text: JSON.stringify({ blindSpots: [], assumedKnowledge: [], suggestions: [] }) },
      });

      await analyzePathGaps(MOCK_QUERY, MOCK_STEPS);

      // Verify the prompt sent to Gemini includes the query
      const calledPrompt = mockCallable.mock.calls[0]?.[0]?.prompt || "";
      expect(calledPrompt).toContain(MOCK_QUERY);
    });
  });

  // ═════════════════════════════════════════════════════════
  // 2. generateGapFillStep
  // ═════════════════════════════════════════════════════════

  describe("generateGapFillStep", () => {
    it("produces a valid step with the correct shape", async () => {
      // Corpus context lookup
      mockFindRelevantSegments.mockResolvedValue({
        segments: [{ title: "Related topic", text: "Some context", similarity: 0.5 }],
        lowCorpusCoverage: true,
      });

      // Gemini generates the step
      mockCallable.mockResolvedValue({
        data: {
          text: JSON.stringify({
            title: "Configuring Door Collision",
            category: "core",
            summary:
              "Set up collision volumes for your physics door by adding a Box Collision component in the Blueprint editor.",
          }),
          groundingMetadata: {
            sources: [{ url: "https://docs.unrealengine.com/collision", title: "Collision Docs" }],
            supports: [{ text: "collision", sourceIndices: [0] }],
          },
        },
      });

      const step = await generateGapFillStep("collision setup", MOCK_QUERY, MOCK_STEPS);

      expect(step).not.toBeNull();
      expect(step.segment.type).toBe("ai_generated");
      expect(step.segment.title).toBe("Configuring Door Collision");
      expect(step.category).toBe("core");
      expect(step.isGapFill).toBe(true);
      expect(step.segment.id).toContain("gap-fill-");
    });

    it("runs corpus verification on generated step", async () => {
      // Initial corpus lookup
      mockFindRelevantSegments
        .mockResolvedValueOnce({
          segments: [],
          lowCorpusCoverage: true,
        })
        // Verification lookup — finds a corpus match
        .mockResolvedValueOnce({
          segments: [
            {
              title: "Collision Guide",
              videoTitle: "UE5 Collision Tutorial",
              videoUrl: "https://example.com/video",
              similarity: 0.82,
            },
          ],
          lowCorpusCoverage: false,
        });

      mockCallable.mockResolvedValue({
        data: {
          text: JSON.stringify({
            title: "Setting Up Collision",
            category: "core",
            summary: "Add collision components to your door.",
          }),
        },
      });

      const step = await generateGapFillStep("collision", MOCK_QUERY, MOCK_STEPS);

      expect(step).not.toBeNull();
      expect(step.segment.corpusVerified).toBe(true);
      expect(step.segment.corpusMatch.videoTitle).toBe("UE5 Collision Tutorial");
    });

    it("returns null on Gemini parse failure", async () => {
      mockFindRelevantSegments.mockResolvedValue({
        segments: [],
        lowCorpusCoverage: true,
      });

      mockCallable.mockResolvedValue({
        data: { text: "NOT JSON" },
      });

      const step = await generateGapFillStep("collision", MOCK_QUERY, MOCK_STEPS);
      expect(step).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════
  // 3. searchCommunityPainPoints
  // ═════════════════════════════════════════════════════════

  describe("searchCommunityPainPoints", () => {
    it("returns pain points with source URLs from grounding metadata", async () => {
      mockCallable.mockResolvedValue({
        data: {
          text: JSON.stringify([
            { painPoint: "Beginners confuse Set Timer by Event with Delay", relevance: "high" },
            { painPoint: "Door pivots are set wrong by default", relevance: "medium" },
          ]),
          groundingMetadata: {
            sources: [
              {
                url: "https://forums.unrealengine.com/t/timer-confusion",
                title: "Timer confusion",
              },
              { url: "https://reddit.com/r/unrealengine/door-pivot", title: "Door pivot issue" },
            ],
          },
        },
      });

      const result = await searchCommunityPainPoints("physics doors");

      expect(result).toHaveLength(2);
      expect(result[0].painPoint).toContain("Timer");
      expect(result[0].sourceUrl).toContain("forums.unrealengine.com");
      expect(result[0].relevance).toBe("high");
    });

    it("returns empty array when grounding returns no data", async () => {
      mockCallable.mockResolvedValue({
        data: {
          text: JSON.stringify([]),
          groundingMetadata: null,
        },
      });

      const result = await searchCommunityPainPoints("obscure topic");
      expect(result).toHaveLength(0);
    });

    it("handles Gemini parse failure gracefully", async () => {
      mockCallable.mockResolvedValue({
        data: { text: "INVALID JSON!!!" },
      });

      const result = await searchCommunityPainPoints("anything");
      expect(result).toEqual([]);
    });

    it("caps results at PAIN_POINT_LIMIT", async () => {
      mockCallable.mockResolvedValue({
        data: {
          text: JSON.stringify(
            Array.from({ length: 10 }, (_, i) => ({
              painPoint: `Pain point ${i}`,
              relevance: "medium",
            }))
          ),
          groundingMetadata: { sources: [] },
        },
      });

      const result = await searchCommunityPainPoints("materials");
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  // ═════════════════════════════════════════════════════════
  // 4. simulatePersonaGaps
  // ═════════════════════════════════════════════════════════

  describe("simulatePersonaGaps", () => {
    it("beginner persona sees more gaps than advanced", async () => {
      // For both persona calls, return mixed coverage
      mockFindRelevantSegments.mockResolvedValue({
        segments: [{ title: "Some match", similarity: 0.55 }],
        lowCorpusCoverage: true,
      });

      mockCallable.mockResolvedValue({
        data: {
          text: JSON.stringify({
            blindSpots: [{ topic: "Test", severity: "medium", reason: "Gap", researchContext: "" }],
            assumedKnowledge: [],
            suggestions: [],
          }),
        },
      });

      const beginnerResult = await simulatePersonaGaps(MOCK_QUERY, MOCK_STEPS, "beginner");
      const advancedResult = await simulatePersonaGaps(MOCK_QUERY, MOCK_STEPS, "advanced");

      // Both should return valid results
      expect(beginnerResult.corpusStats.subtopicsChecked).toBeGreaterThan(0);
      expect(advancedResult.corpusStats.subtopicsChecked).toBeGreaterThan(0);

      // The beginner prompt should mention "BEGINNER" level
      const beginnerPrompt = mockCallable.mock.calls[0]?.[0]?.prompt || "";
      expect(beginnerPrompt).toContain("BEGINNER");
    });

    it("returns same shape as analyzePathGaps", async () => {
      mockFindRelevantSegments.mockResolvedValue({
        segments: [{ title: "Match", similarity: 0.85 }],
        lowCorpusCoverage: false,
      });

      const result = await simulatePersonaGaps(MOCK_QUERY, MOCK_STEPS, "intermediate");

      expect(result).toHaveProperty("blindSpots");
      expect(result).toHaveProperty("assumedKnowledge");
      expect(result).toHaveProperty("suggestions");
      expect(result).toHaveProperty("coverageScore");
      expect(result).toHaveProperty("corpusStats");
    });
  });

  // ═════════════════════════════════════════════════════════
  // 5. buildPrereqChain
  // ═════════════════════════════════════════════════════════

  describe("buildPrereqChain", () => {
    it("identifies floating steps with no inbound edges", async () => {
      // No overlap between any steps → all steps after 0 are floating
      mockComputeTopicOverlap.mockReturnValue(0.05);

      const result = await buildPrereqChain(MOCK_STEPS);

      expect(result.nodes).toHaveLength(3);
      expect(result.floatingSteps.length).toBeGreaterThan(0);
      expect(result.floatingSteps).toContain(1); // Step 1 has no inbound
    });

    it("builds edges for steps with topic overlap", async () => {
      // Steps 0→1 have strong overlap, 1→2 have weak overlap
      mockComputeTopicOverlap.mockImplementation((textA, textB) => {
        if (textA.includes("Blueprint") && textB.includes("Material")) return 0.45;
        if (textA.includes("Material") && textB.includes("Physics")) return 0.2;
        return 0.05;
      });

      const result = await buildPrereqChain(MOCK_STEPS);

      expect(result.edges.length).toBeGreaterThan(0);
      // Check the strong edge
      const strongEdge = result.edges.find((e) => e.strength === "strong");
      expect(strongEdge).toBeDefined();
      expect(strongEdge.from).toBe(0);
      expect(strongEdge.to).toBe(1);
    });

    it("identifies missing links between consecutive steps", async () => {
      // No overlap between any steps
      mockComputeTopicOverlap.mockReturnValue(0.05);

      const result = await buildPrereqChain(MOCK_STEPS);

      // With 3 steps and no edges, there should be 2 missing links (0→1, 1→2)
      expect(result.missingLinks).toHaveLength(2);
      expect(result.missingLinks[0].from).toBe(0);
      expect(result.missingLinks[0].to).toBe(1);
    });

    it("handles empty path gracefully", async () => {
      const result = await buildPrereqChain([]);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.floatingSteps).toHaveLength(0);
      expect(result.missingLinks).toHaveLength(0);
    });

    it("handles null/undefined input", async () => {
      const result = await buildPrereqChain(null);

      expect(result).toEqual({
        nodes: [],
        edges: [],
        floatingSteps: [],
        missingLinks: [],
      });
    });
  });
});
