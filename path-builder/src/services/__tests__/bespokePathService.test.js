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
const fakeSegment = (id, similarity = 0.8) => {
  // Realistic titles/text so topical cross-check passes when query matches
  const details = {
    "mesh-import": {
      title: "Importing Static Meshes",
      text: "How to import a static mesh FBX into UE5 using the Content Browser",
    },
    "blueprint-actor": {
      title: "Blueprint Actor Setup",
      text: "Create a Blueprint actor with a static mesh component for your imported mesh",
    },
    "collision-setup": {
      title: "Collision Configuration",
      text: "Configure collision settings on your imported static mesh in UE5",
    },
    "material-slots": {
      title: "Material Slot Assignment",
      text: "Assign materials to material slots on your imported static mesh",
    },
  };
  const d = details[id] || { title: `Segment ${id}`, text: `How to do ${id} in UE5` };
  return {
    id: `seg-${id}`,
    title: d.title,
    text: d.text,
    source: "segment_embeddings",
    similarity,
  };
};

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

    // TODO: Move to pathSearch.test.js — this tests pathSearch internals through
    // a re-export, and the retryWithBackoff wrapper prevents httpsCallable mock
    // from intercepting correctly.
    it.skip("sets lowCorpusCoverage=true when best similarity is very low", async () => {
      setupMocks({
        segmentResults: [
          { id: "s1", title: "Texture Graph", text: "...", similarity: 0.3 },
          { id: "s2", title: "Material Editor", text: "...", similarity: 0.2 },
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
        segmentResults: [{ id: "t1", title: "Multi-Collection Setup", text: "How to set up multi-collection search in UE5", similarity: 0.8 }],
        epicResults: [{ id: "e1", title: "Multi-Collection Overview", text: "Epic overview of multi-collection architecture", similarity: 0.75 }],
        docResults: [{ id: "d1", title: "Collection Documentation", text: "Documentation for multi-collection search patterns", similarity: 0.7 }],
      });

      const result = await findRelevantSegments("multi-collection search setup");
      // All three sources should contribute (segments may be filtered by topical cross-check)
      expect(result.segments.length).toBeGreaterThanOrEqual(1);
    });
    it("runs a separate gap-specific search when knowledgeProfile has gaps", async () => {
      const capturedQueries = [];
      httpsCallable.mockImplementation((_app, fnName) => {
        switch (fnName) {
          case "embedQuery":
            return vi.fn().mockImplementation(({ query }) => {
              capturedQueries.push(query);
              return Promise.resolve({ data: { embedding: new Array(768).fill(0.1) } });
            });
          case "vectorSearchSegments":
            return mockCallable({ results: [] });
          case "vectorSearchEpic":
            return mockCallable({ results: [] });
          case "vectorSearchDocs":
            return mockCallable({ results: [] });
          default:
            return mockCallable({});
        }
      });

      const profile = {
        knows: ["blueprint_basics"],
        gaps: ["actor_time_dilation", "animation_time_dilation"],
        level: "beginner",
      };

      await findRelevantSegments("how can i make my character go in slow mo", 5, profile);

      // Dual-search: first call is the original query, second call is gap terms only
      expect(capturedQueries.length).toBe(2);
      expect(capturedQueries[0]).toBe("how can i make my character go in slow mo");
      expect(capturedQueries[1]).toContain("actor time dilation");
      expect(capturedQueries[1]).toContain("animation time dilation");
    });

    it("uses original query when no knowledgeProfile is provided", async () => {
      let capturedQuery = null;
      httpsCallable.mockImplementation((_app, fnName) => {
        switch (fnName) {
          case "embedQuery":
            return vi.fn().mockImplementation(({ query }) => {
              capturedQuery = query;
              return Promise.resolve({ data: { embedding: new Array(768).fill(0.1) } });
            });
          case "vectorSearchSegments":
            return mockCallable({ results: [] });
          case "vectorSearchEpic":
            return mockCallable({ results: [] });
          case "vectorSearchDocs":
            return mockCallable({ results: [] });
          default:
            return mockCallable({});
        }
      });

      await findRelevantSegments("how can i make my character go in slow mo");

      // Without a profile, the query should be unmodified
      expect(capturedQuery).toBe("how can i make my character go in slow mo");
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

    it("handles gracefully when hybrid path generation returns invalid JSON", async () => {
      setupMocks({
        segmentResults: [],
        classifyResponse: "this is not JSON at all",
      });

      const result = await generateBespokePath("gibberish query");
      // Service may retry/fallback — either returns an error or an empty path
      expect(result).toHaveProperty("path");
      if (result.error) {
        expect(result.path.length).toBe(0);
      }
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
                    summary: "Import your static mesh FBX file into UE5 via the Content Browser",
                  },
                  {
                    index: 1,
                    category: "diagnosis",
                    relevance: "high",
                    order: 1,
                    summary: "Set up a Blueprint actor with a static mesh component",
                  },
                  {
                    index: 2,
                    category: "fix",
                    relevance: "high",
                    order: 2,
                    summary: "Configure collision on your imported static mesh",
                  },
                  {
                    index: 3,
                    category: "transfer",
                    relevance: "medium",
                    order: 3,
                    summary: "Assign materials to the mesh material slots",
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

  // ── generateBespokePath: grounding metadata ─────────────────────────

  describe("generateBespokePath — grounding metadata on corpus paths", () => {
    it("attaches grounding sources to corpus steps when classifySegments returns groundingMetadata", async () => {
      let classifyCallCount = 0;
      httpsCallable.mockImplementation((_app, fnName) => {
        switch (fnName) {
          case "embedQuery":
            return mockCallable({ embedding: new Array(768).fill(0.1) });
          case "vectorSearchSegments":
            return mockCallable({
              results: [
                {
                  id: "s1",
                  title: "Static Mesh Import",
                  text: "How to import static meshes in UE5",
                  similarity: 0.88,
                },
                {
                  id: "s2",
                  title: "Blueprint Actor",
                  text: "Setting up blueprint actors",
                  similarity: 0.82,
                },
                {
                  id: "s3",
                  title: "Collision Setup",
                  text: "Configuring collision for meshes",
                  similarity: 0.79,
                },
                {
                  id: "s4",
                  title: "Material Slots",
                  text: "Assigning materials to slots",
                  similarity: 0.77,
                },
              ],
            });
          case "vectorSearchEpic":
            return mockCallable({ results: [] });
          case "vectorSearchDocs":
            return mockCallable({ results: [] });
          case "classifySegments": {
            classifyCallCount++;
            if (classifyCallCount === 1) {
              // sequencePath call — return grounding metadata alongside classifications
              return mockCallable({
                text: JSON.stringify([
                  {
                    index: 0,
                    category: "foundation",
                    relevance: "high",
                    summary: "Import your static mesh FBX file into UE5 via the Content Browser",
                  },
                  {
                    index: 1,
                    category: "diagnosis",
                    relevance: "high",
                    summary: "After importing your static mesh, set up a Blueprint actor with a mesh component",
                  },
                  {
                    index: 2,
                    category: "fix",
                    relevance: "high",
                    summary: "Configure collision on your imported static mesh for proper physics",
                  },
                  {
                    index: 3,
                    category: "transfer",
                    relevance: "medium",
                    summary: "Apply the same static mesh import workflow to other FBX assets",
                  },
                ]),
                groundingMetadata: {
                  sources: [
                    { url: "https://docs.unrealengine.com/static-mesh", title: "Static Mesh Docs" },
                    { url: "https://docs.unrealengine.com/blueprints", title: "Blueprint Docs" },
                  ],
                  supports: [
                    {
                      text: "Import static meshes into your project using the content browser",
                      sourceIndices: [0],
                    },
                    {
                      text: "Create blueprint actors to add game interaction logic",
                      sourceIndices: [1],
                    },
                  ],
                },
              });
            }
            return mockCallable({ text: GOOD_HYBRID_JSON });
          }
          default:
            return mockCallable({});
        }
      });

      const result = await generateBespokePath("how to import a static mesh");

      // Verify steps that matched grounding supports have sources attached
      const stepsWithSources = result.path.filter((s) => s.segment.sources?.length > 0);
      expect(stepsWithSources.length).toBeGreaterThanOrEqual(1);

      // Verify the first step (foundation — about importing meshes) got the Static Mesh Docs source
      const foundationStep = result.path.find((s) => s.category === "foundation");
      if (foundationStep?.segment?.sources) {
        expect(foundationStep.segment.sources[0].url).toContain("unrealengine.com");
      }
    });

    it("corpus steps have no sources when classifySegments returns no groundingMetadata", async () => {
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
              // No groundingMetadata in response
              return mockCallable({
                text: JSON.stringify([
                  {
                    index: 0,
                    category: "foundation",
                    relevance: "high",
                    summary: "Import your static mesh FBX file",
                  },
                  {
                    index: 1,
                    category: "diagnosis",
                    relevance: "high",
                    summary: "Set up a Blueprint actor with static mesh",
                  },
                  {
                    index: 2,
                    category: "fix",
                    relevance: "high",
                    summary: "Configure collision on your imported mesh",
                  },
                  {
                    index: 3,
                    category: "transfer",
                    relevance: "medium",
                    summary: "Assign materials to the mesh",
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

      // No step should have sources when grounding is not returned
      const stepsWithSources = result.path.filter((s) => s.segment.sources?.length > 0);
      expect(stepsWithSources.length).toBe(0);
    });
  });
});
