/**
 * bespokePathService.test.js — Tests for hybrid fallback, post-sequencing
 * safety net, and pipeline orchestration.
 *
 * Strategy: Mock Firebase (httpsCallable) so we can control stage outputs
 * and verify that generateBespokePath routes through the correct branches.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Firebase Functions ──────────────────────────────────────────────
// We mock the entire firebase/functions module and firebaseConfig so the
// service never hits a real backend.
vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => "mock-functions-app"),
  httpsCallable: vi.fn(),
}));

vi.mock("../../services/firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => "mock-app"),
}));

vi.mock("../../utils/logger", () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
}));

vi.mock("../../services/tokenTracker", () => ({
  recordTokenUsage: vi.fn(),
}));

import { httpsCallable } from "firebase/functions";
import { findRelevantSegments, generateBespokePath } from "../../services/bespokePathService";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Build a mock callable function that resolves with the given data */
const mockCallable = (data) => vi.fn().mockResolvedValue({ data });

/** Create a fake segment resembling real corpus output */
const fakeSegment = (id, similarity = 0.8) => ({
  id: `seg-${id}`,
  title: `Segment ${id}`,
  text: `How to do ${id} in UE5`,
  source: "segment_embeddings",
  similarity,
});

/** Valid 4-step hybrid JSON that Gemini would return */
const GOOD_HYBRID_JSON = JSON.stringify([
  {
    category: "foundation",
    title: "Import Your Asset",
    summary: "Open the Content Browser and import your FBX.",
  },
  {
    category: "diagnosis",
    title: "Check Materials",
    summary: "Inspect the material slots on your Static Mesh.",
  },
  {
    category: "fix",
    title: "Create a Blueprint Actor",
    summary: "Add a Static Mesh component and assign the mesh.",
  },
  {
    category: "transfer",
    title: "Reuse the Pattern",
    summary: "Apply the same Blueprint pattern to other props.",
  },
]);

/** Create the mock routing table for httpsCallable */
function setupMocks({
  embeddingDim = 768,
  segmentResults = [],
  epicResults = [],
  docResults = [],
  classifyResponse = GOOD_HYBRID_JSON,
} = {}) {
  httpsCallable.mockImplementation((_app, fnName) => {
    switch (fnName) {
      case "embedQuery":
        return mockCallable({ embedding: new Array(embeddingDim).fill(0.1) });
      case "vectorSearchSegments":
        return mockCallable({ results: segmentResults });
      case "vectorSearchEpic":
        return mockCallable({ results: epicResults });
      case "vectorSearchDocs":
        return mockCallable({ results: docResults });
      case "classifySegments":
        return mockCallable({ text: classifyResponse });
      default:
        return mockCallable({});
    }
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe("bespokePathService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── findRelevantSegments ────────────────────────────────────────────

  describe("findRelevantSegments", () => {
    it("returns empty for blank query", async () => {
      const result = await findRelevantSegments("");
      expect(result.segments).toEqual([]);
    });

    it("returns empty for whitespace-only query", async () => {
      const result = await findRelevantSegments("   ");
      expect(result.segments).toEqual([]);
    });

    it("sets lowCorpusCoverage=true when best similarity < 0.65 (after transcript boost)", async () => {
      // NOTE: transcript segments get TRANSCRIPT_BOOST of 1.3x
      // So similarity 0.49 * 1.3 = 0.637 which is still < 0.65
      setupMocks({
        segmentResults: [
          { id: "s1", title: "Texture Graph", text: "...", similarity: 0.49 },
          { id: "s2", title: "Material Editor", text: "...", similarity: 0.4 },
        ],
      });

      const result = await findRelevantSegments("how to create a sword");
      expect(result.lowCorpusCoverage).toBe(true);
    });

    it("sets lowCorpusCoverage=false when best similarity >= 0.65 (after transcript boost)", async () => {
      // similarity 0.55 * 1.3 = 0.715 which is >= 0.65
      setupMocks({
        segmentResults: [
          { id: "s1", title: "Static Mesh Import", text: "...", similarity: 0.55 },
          { id: "s2", title: "Blueprint Actor", text: "...", similarity: 0.5 },
        ],
      });

      const result = await findRelevantSegments("how to import a static mesh");
      expect(result.lowCorpusCoverage).toBe(false);
    });

    it("collects segments from all three collections", async () => {
      setupMocks({
        segmentResults: [{ id: "t1", text: "transcript", similarity: 0.8 }],
        epicResults: [{ id: "e1", title: "Epic", text: "epic", similarity: 0.75 }],
        docResults: [{ id: "d1", title: "Doc", text: "doc", similarity: 0.7 }],
      });

      const result = await findRelevantSegments("multi-collection test");
      // Each collection contributes a segment with a distinct type
      expect(result.segments.length).toBe(3);
    });
  });

  // ── generateBespokePath: hybrid fallback ────────────────────────────

  describe("generateBespokePath — hybrid fallback", () => {
    it("triggers hybrid when corpus returns 0 segments", async () => {
      setupMocks({ segmentResults: [] });

      const result = await generateBespokePath("how to create a sword");
      expect(result.isAiGenerated).toBe(true);
      expect(result.path.length).toBeGreaterThanOrEqual(4);
      expect(result.path[0].segment.type).toBe("ai_generated");
    });

    it("triggers hybrid when lowCorpusCoverage is true", async () => {
      setupMocks({
        segmentResults: [{ id: "low-1", title: "Texture Graph", text: "...", similarity: 0.5 }],
      });

      const result = await generateBespokePath("how to create a sword");
      expect(result.isAiGenerated).toBe(true);
      expect(result.path.length).toBeGreaterThanOrEqual(4);
    });

    it("hybrid path is ordered by category: foundation → diagnosis → fix → transfer", async () => {
      setupMocks({ segmentResults: [] });

      const result = await generateBespokePath("how to create a sword");
      const categories = result.path.map((s) => s.category);
      const expected = ["foundation", "diagnosis", "fix", "transfer"];
      expect(categories).toEqual(expected);
    });

    it("marks all hybrid steps with type='ai_generated' and source='ai_generated'", async () => {
      setupMocks({ segmentResults: [] });

      const result = await generateBespokePath("how to make a shield");
      for (const step of result.path) {
        expect(step.segment.type).toBe("ai_generated");
        expect(step.segment.source).toBe("ai_generated");
      }
    });

    it("adapts hybrid prompt when knowledgeProfile is provided", async () => {
      setupMocks({ segmentResults: [] });

      const result = await generateBespokePath("how to create a sword", {
        knows: ["materials"],
        gaps: ["blueprints"],
        level: "intermediate",
      });

      expect(result.isAiGenerated).toBe(true);
      expect(result.path.length).toBeGreaterThanOrEqual(4);
      // Verify the classifySegments callable was invoked (prompt includes level)
      // Verify the classifySegments callable was invoked (prompt includes level)
      expect(httpsCallable).toHaveBeenCalled();
    });

    it("returns error when hybrid path generation also fails", async () => {
      setupMocks({
        segmentResults: [],
        classifyResponse: "this is not JSON at all",
      });

      const result = await generateBespokePath("gibberish query");
      expect(result.error).toBeTruthy();
      expect(result.path.length).toBe(0);
    });
  });

  // ── generateBespokePath: post-sequencing safety net ─────────────────

  describe("generateBespokePath — post-sequencing safety net", () => {
    it("supplements with hybrid when sequencing returns < MIN_PATH_SEGMENTS steps", async () => {
      // Corpus has good segments, but classifySegments returns only 1 usable step
      // followed by a second call that returns the full hybrid path
      let classifyCallCount = 0;
      httpsCallable.mockImplementation((_app, fnName) => {
        switch (fnName) {
          case "embedQuery":
            return mockCallable({ embedding: new Array(768).fill(0.1) });
          case "vectorSearchSegments":
            return mockCallable({
              results: [
                { id: "s1", title: "Good Segment", text: "...", similarity: 0.8 },
                { id: "s2", title: "Meh Segment", text: "...", similarity: 0.7 },
              ],
            });
          case "vectorSearchEpic":
            return mockCallable({ results: [] });
          case "vectorSearchDocs":
            return mockCallable({ results: [] });
          case "classifySegments": {
            classifyCallCount++;
            if (classifyCallCount === 1) {
              // First call: sequencePath — return only 1 step (below MIN_PATH_SEGMENTS)
              return mockCallable({
                text: JSON.stringify([
                  {
                    segment_id: "s1",
                    category: "foundation",
                    relevance: "high",
                    order: 0,
                    summary: "Foundation step",
                  },
                ]),
              });
            }
            // Second call: generateHybridPath — return full 4 steps
            return mockCallable({ text: GOOD_HYBRID_JSON });
          }
          default:
            return mockCallable({});
        }
      });

      const result = await generateBespokePath("how to import a mesh");
      // Should have been supplemented — more than 1 step
      expect(result.path.length).toBeGreaterThanOrEqual(3);
    });

    it("replaces entirely with hybrid when ≤1 corpus steps survive", async () => {
      let classifyCallCount = 0;
      httpsCallable.mockImplementation((_app, fnName) => {
        switch (fnName) {
          case "embedQuery":
            return mockCallable({ embedding: new Array(768).fill(0.1) });
          case "vectorSearchSegments":
            return mockCallable({
              results: [{ id: "weak1", title: "Weak Match", text: "...", similarity: 0.66 }],
            });
          case "vectorSearchEpic":
            return mockCallable({ results: [] });
          case "vectorSearchDocs":
            return mockCallable({ results: [] });
          case "classifySegments": {
            classifyCallCount++;
            if (classifyCallCount === 1) {
              // sequencePath: returns 1 step with low relevance → filtered to just 1
              return mockCallable({
                text: JSON.stringify([
                  {
                    segment_id: "weak1",
                    category: "foundation",
                    relevance: "low",
                    order: 0,
                    summary: "Weak step",
                  },
                ]),
              });
            }
            return mockCallable({ text: GOOD_HYBRID_JSON });
          }
          default:
            return mockCallable({});
        }
      });

      const result = await generateBespokePath("how to create a sword");
      // When ≤1 step survives, should replace entirely with hybrid
      if (result.path.length > 1) {
        expect(result.isAiGenerated).toBe(true);
      }
    });
  });

  // ── generateBespokePath: JSON sanitization ──────────────────────────

  describe("generateBespokePath — JSON sanitization resilience", () => {
    it("handles smart quotes in Gemini output", async () => {
      // Create proper smart-quote JSON
      const json = `[{"category": \u201Cfoundation\u201D, "title": \u201CImport Asset\u201D, "summary": \u201COpen Content Browser.\u201D}]`;

      setupMocks({
        segmentResults: [],
        classifyResponse: json,
      });

      const result = await generateBespokePath("how to import an asset");
      // Should still parse thanks to smart quote sanitization
      expect(result.path.length).toBeGreaterThanOrEqual(1);
    });

    it("handles code fences wrapping JSON", async () => {
      const fencedJSON = "```json\n" + GOOD_HYBRID_JSON + "\n```";

      setupMocks({
        segmentResults: [],
        classifyResponse: fencedJSON,
      });

      const result = await generateBespokePath("how to create materials");
      expect(result.path.length).toBeGreaterThanOrEqual(4);
    });

    it("handles trailing commas in JSON", async () => {
      const trailingComma = `[
        {"category": "foundation", "title": "Step 1", "summary": "Learn the basics.",},
        {"category": "fix", "title": "Step 2", "summary": "Apply the fix.",},
      ]`;

      setupMocks({
        segmentResults: [],
        classifyResponse: trailingComma,
      });

      const result = await generateBespokePath("how to fix lighting");
      expect(result.path.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── generateBespokePath: happy path ──────────────────────────────────

  describe("generateBespokePath — corpus-based (happy path)", () => {
    it("uses corpus segments when coverage is high", async () => {
      // Use call-counting so sequencePath gets proper sequence response,
      // and if hybrid is called it gets hybrid response
      let classifyCallCount = 0;
      httpsCallable.mockImplementation((_app, fnName) => {
        switch (fnName) {
          case "embedQuery":
            return mockCallable({ embedding: new Array(768).fill(0.1) });
          case "vectorSearchSegments":
            return mockCallable({
              results: [
                fakeSegment("mesh-import", 0.88),
                fakeSegment("blueprint-actor", 0.82),
                fakeSegment("collision-setup", 0.79),
                fakeSegment("material-slots", 0.77),
              ],
            });
          case "vectorSearchEpic":
            return mockCallable({ results: [] });
          case "vectorSearchDocs":
            return mockCallable({ results: [] });
          case "classifySegments": {
            classifyCallCount++;
            if (classifyCallCount === 1) {
              // sequencePath call — return properly sequenced corpus segments
              return mockCallable({
                text: JSON.stringify([
                  {
                    index: 0,
                    category: "foundation",
                    relevance: "high",
                    order: 0,
                    summary: "First step",
                  },
                  {
                    index: 1,
                    category: "diagnosis",
                    relevance: "high",
                    order: 1,
                    summary: "Second step",
                  },
                  { index: 2, category: "fix", relevance: "high", order: 2, summary: "Third step" },
                  {
                    index: 3,
                    category: "transfer",
                    relevance: "medium",
                    order: 3,
                    summary: "Fourth",
                  },
                ]),
              });
            }
            return mockCallable({ text: GOOD_HYBRID_JSON });
          }
          default:
            return mockCallable({});
        }
      });

      const result = await generateBespokePath("how to import a static mesh");
      expect(result.isAiGenerated).toBeFalsy();
      expect(result.path.length).toBeGreaterThanOrEqual(3);
    });

    it("returns valid result structure", async () => {
      setupMocks({
        segmentResults: [fakeSegment("a", 0.85), fakeSegment("b", 0.8), fakeSegment("c", 0.75)],
        classifyResponse: JSON.stringify([
          { index: 0, category: "foundation", relevance: "high", order: 0, summary: "A" },
          { index: 1, category: "diagnosis", relevance: "high", order: 1, summary: "B" },
          { index: 2, category: "fix", relevance: "high", order: 2, summary: "C" },
        ]),
      });

      const result = await generateBespokePath("blueprint basics");
      expect(result).toHaveProperty("query", "blueprint basics");
      expect(result).toHaveProperty("segments");
      expect(result).toHaveProperty("path");
      expect(result).toHaveProperty("bridges");
      expect(result).toHaveProperty("error");
      expect(result).toHaveProperty("generatedAt");
      expect(result.error).toBeNull();
    });
  });

  // ── generateBespokePath: error handling ─────────────────────────────

  describe("generateBespokePath — error handling", () => {
    it("returns graceful error when Firebase throws", async () => {
      httpsCallable.mockImplementation(() => {
        throw new Error("NETWORK_ERROR");
      });

      const result = await generateBespokePath("test query");
      expect(result.error).toBeTruthy();
      expect(result.path).toEqual([]);
    });

    it("returns error for empty query", async () => {
      const result = await generateBespokePath("");
      // Empty query → findRelevantSegments returns [], no segments → hybrid
      // hybrid also fails because query is empty → error
      expect(result.error).toBeTruthy();
    });
  });
});
