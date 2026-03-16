/**
 * pathNarration.js — Unit tests
 *
 * Tests input validation and fallback narration behavior.
 * Firebase AI calls are mocked.
 */
import { describe, it, expect, vi } from "vitest";

// Mock Firebase modules before importing pathNarration
vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => vi.fn()),
}));
vi.mock("../firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));
vi.mock("../tokenTracker", () => ({
  recordTokenUsage: vi.fn(),
}));
vi.mock("../../utils/retryWithBackoff", () => ({
  retryWithBackoff: vi.fn((fn) => fn()),
}));

import { generateBridgeNarration } from "../pathNarration";

describe("pathNarration", () => {
  // -- Input validation --

  describe("generateBridgeNarration", () => {
    it("should return empty array for null path", async () => {
      expect(await generateBridgeNarration(null, "test")).toEqual([]);
    });

    it("should return empty array for single-step path", async () => {
      const singleStep = [
        { segment: { text: "Some content" }, category: "foundation" },
      ];
      expect(await generateBridgeNarration(singleStep, "test")).toEqual([]);
    });

    it("should generate fallback narrations when AI fails", async () => {
      const { httpsCallable } = await import("firebase/functions");
      httpsCallable.mockReturnValue(
        vi.fn(async () => {
          throw new Error("Cloud Function unavailable");
        })
      );

      const path = [
        { segment: { text: "Foundation content about blueprints" }, category: "foundation" },
        { segment: { text: "Diagnosis content about debugging" }, category: "diagnosis" },
        { segment: { text: "Fix content about resolving issues" }, category: "fix" },
      ];

      const result = await generateBridgeNarration(path, "blueprint debugging");

      // Should produce 2 bridges (between 3 steps)
      expect(result).toHaveLength(2);

      // First bridge: foundation → diagnosis
      expect(result[0].from).toBe(0);
      expect(result[0].to).toBe(1);
      expect(result[0].narration).toContain("identify");

      // Second bridge: diagnosis → fix
      expect(result[1].from).toBe(1);
      expect(result[1].to).toBe(2);
      expect(result[1].narration).toContain("resolve");
    });

    it("should use default template for unknown category transitions", async () => {
      const { httpsCallable } = await import("firebase/functions");
      httpsCallable.mockReturnValue(
        vi.fn(async () => {
          throw new Error("Unavailable");
        })
      );

      const path = [
        { segment: { text: "Transfer content" }, category: "transfer" },
        { segment: { text: "Foundation content" }, category: "foundation" },
      ];

      const result = await generateBridgeNarration(path, "test");
      expect(result).toHaveLength(1);
      expect(result[0].narration).toContain("continue");
    });
  });
});
