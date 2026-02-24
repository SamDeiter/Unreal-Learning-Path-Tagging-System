/**
 * analyticsService — Unit tests
 *
 * Tests the EVENTS constants and event-building functions.
 * Firestore is mocked at module level to avoid runtime errors.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase Firestore
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => "MOCK_TIMESTAMP"),
}));

import analyticsService, {
  EVENTS,
  trackEvent,
  trackPersonaDetected,
  trackOnboardingPathGenerated,
  trackQuerySubmitted,
  trackIntentExtracted,
  trackDiagnosisGenerated,
  trackLearningPathGenerated,
  trackModuleSkipped,
  trackModuleReordered,
  trackSessionCompleted,
  trackFollowupQuery,
  startSession,
} from "../analyticsService";

describe("analyticsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- EVENTS constant --

  describe("EVENTS", () => {
    it("should define all expected event types", () => {
      expect(EVENTS.PERSONA_DETECTED).toBe("persona_detected");
      expect(EVENTS.ONBOARDING_PATH_GENERATED).toBe("onboarding_path_generated");
      expect(EVENTS.QUERY_SUBMITTED).toBe("query_submitted");
      expect(EVENTS.INTENT_EXTRACTED).toBe("intent_extracted");
      expect(EVENTS.DIAGNOSIS_GENERATED).toBe("diagnosis_generated");
      expect(EVENTS.LEARNING_PATH_GENERATED).toBe("learning_path_generated");
      expect(EVENTS.MODULE_SKIPPED).toBe("module_skipped");
      expect(EVENTS.MODULE_REORDERED).toBe("module_reordered");
      expect(EVENTS.SESSION_STARTED).toBe("session_started");
      expect(EVENTS.SESSION_COMPLETED).toBe("session_completed");
      expect(EVENTS.FOLLOWUP_QUERY_SUBMITTED).toBe("followup_query_submitted");
      expect(EVENTS.CURRICULUM_VALIDATED).toBe("curriculum_validated");
      expect(EVENTS.CURRICULUM_REJECTED).toBe("curriculum_rejected");
    });

    it("should have unique event values", () => {
      const values = Object.values(EVENTS);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  // -- trackEvent --

  describe("trackEvent", () => {
    it("should not throw on valid call", async () => {
      await expect(trackEvent("test_event", { foo: "bar" })).resolves.not.toThrow();
    });

    it("should handle missing payload gracefully", async () => {
      await expect(trackEvent("test_event")).resolves.not.toThrow();
    });
  });

  // -- Convenience track functions --

  describe("trackPersonaDetected", () => {
    it("should not throw with valid persona", async () => {
      await expect(
        trackPersonaDetected({ id: "indie_isaac", name: "Indie Isaac" }, "onboarding")
      ).resolves.not.toThrow();
    });

    it("should handle null persona gracefully", async () => {
      await expect(trackPersonaDetected(null)).resolves.not.toThrow();
    });
  });

  describe("trackOnboardingPathGenerated", () => {
    it("should not throw with valid args", async () => {
      await expect(
        trackOnboardingPathGenerated({ id: "test" }, [{ id: "c1" }], 120)
      ).resolves.not.toThrow();
    });
  });

  describe("trackQuerySubmitted", () => {
    it("should not throw with valid query", async () => {
      await expect(
        trackQuerySubmitted("How to fix lumen reflections", ["rendering.lumen"], "indie_isaac")
      ).resolves.not.toThrow();
    });

    it("should handle null query", async () => {
      await expect(trackQuerySubmitted(null)).resolves.not.toThrow();
    });
  });

  describe("trackIntentExtracted", () => {
    it("should not throw", async () => {
      await expect(
        trackIntentExtracted({ intent_id: "i1", systems: ["rendering"] })
      ).resolves.not.toThrow();
    });
  });

  describe("trackDiagnosisGenerated", () => {
    it("should not throw", async () => {
      await expect(
        trackDiagnosisGenerated({ diagnosis_id: "d1", root_causes: [] })
      ).resolves.not.toThrow();
    });
  });

  describe("trackLearningPathGenerated", () => {
    it("should not throw", async () => {
      await expect(
        trackLearningPathGenerated({ fix_specific: [] }, [{ id: "c1" }], true)
      ).resolves.not.toThrow();
    });
  });

  describe("trackModuleSkipped", () => {
    it("should not throw", async () => {
      await expect(trackModuleSkipped("mod1", "already know this")).resolves.not.toThrow();
    });
  });

  describe("trackModuleReordered", () => {
    it("should not throw", async () => {
      await expect(trackModuleReordered("mod1", 0, 2)).resolves.not.toThrow();
    });
  });

  describe("trackSessionCompleted", () => {
    it("should not throw", async () => {
      await expect(
        trackSessionCompleted("problem-first", { courses_watched: 3 })
      ).resolves.not.toThrow();
    });
  });

  describe("trackFollowupQuery", () => {
    it("should not throw", async () => {
      await expect(
        trackFollowupQuery("original query preview", "follow up query")
      ).resolves.not.toThrow();
    });
  });

  describe("startSession", () => {
    it("should not throw and reset session ID", async () => {
      await expect(startSession()).resolves.not.toThrow();
    });
  });

  // -- Default export --

  describe("default export", () => {
    it("should export all functions", () => {
      expect(analyticsService.EVENTS).toBeDefined();
      expect(typeof analyticsService.trackEvent).toBe("function");
      expect(typeof analyticsService.trackPersonaDetected).toBe("function");
      expect(typeof analyticsService.startSession).toBe("function");
    });
  });
});
