/**
 * analyticsService — Unit tests
 *
 * Tests the EVENTS constants, event-building functions, and verifies
 * that each convenience function calls addDoc with the correct event
 * type and expected payload fields.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase Firestore — capture addDoc calls for verification
const mockAddDoc = vi.fn(() => Promise.resolve());
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db, name) => `collection:${name}`),
  addDoc: (...args) => mockAddDoc(...args),
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
    it("calls addDoc with analytics_events collection and correct event name", async () => {
      await trackEvent("test_event", { foo: "bar" });
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const [collectionRef, eventData] = mockAddDoc.mock.calls[0];
      expect(collectionRef).toBe("collection:analytics_events");
      expect(eventData.event).toBe("test_event");
      expect(eventData.foo).toBe("bar");
      expect(eventData.timestamp).toBe("MOCK_TIMESTAMP");
      expect(eventData.client_timestamp).toBeTruthy();
      expect(eventData.session_id).toMatch(/^session_/);
    });

    it("handles missing payload gracefully", async () => {
      await trackEvent("bare_event");
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("bare_event");
    });
  });

  // -- Convenience track functions --

  describe("trackPersonaDetected", () => {
    it("sends PERSONA_DETECTED event with persona fields", async () => {
      await trackPersonaDetected(
        { id: "indie_isaac", name: "Indie Isaac", industry: "gaming" },
        "onboarding"
      );
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("persona_detected");
      expect(eventData.persona_id).toBe("indie_isaac");
      expect(eventData.persona_name).toBe("Indie Isaac");
      expect(eventData.industry).toBe("gaming");
      expect(eventData.source).toBe("onboarding");
    });

    it("handles null persona gracefully", async () => {
      await trackPersonaDetected(null);
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("persona_detected");
      expect(eventData.persona_id).toBeUndefined();
      expect(eventData.source).toBe("onboarding"); // default
    });
  });

  describe("trackOnboardingPathGenerated", () => {
    it("sends ONBOARDING_PATH_GENERATED with course count and time", async () => {
      await trackOnboardingPathGenerated({ id: "test_persona" }, [{ id: "c1" }, { id: "c2" }], 120);
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("onboarding_path_generated");
      expect(eventData.persona_id).toBe("test_persona");
      expect(eventData.course_count).toBe(2);
      expect(eventData.total_minutes).toBe(120);
      expect(eventData.course_ids).toEqual(["c1", "c2"]);
    });
  });

  describe("trackQuerySubmitted", () => {
    it("sends QUERY_SUBMITTED with query metadata", async () => {
      await trackQuerySubmitted(
        "How to fix lumen reflections",
        ["rendering.lumen", "lighting"],
        "indie_isaac"
      );
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("query_submitted");
      expect(eventData.query_length).toBe(28);
      expect(eventData.query_preview).toBe("How to fix lumen reflections");
      expect(eventData.detected_tag_count).toBe(2);
      expect(eventData.detected_tags).toEqual(["rendering.lumen", "lighting"]);
      expect(eventData.persona_id).toBe("indie_isaac");
    });

    it("handles null query", async () => {
      await trackQuerySubmitted(null);
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.query_length).toBe(0);
      expect(eventData.query_preview).toBeUndefined();
    });
  });

  describe("trackIntentExtracted", () => {
    it("sends INTENT_EXTRACTED with system counts", async () => {
      await trackIntentExtracted({
        intent_id: "i1",
        systems: ["rendering", "lighting"],
        constraints: ["PS5"],
      });
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("intent_extracted");
      expect(eventData.intent_id).toBe("i1");
      expect(eventData.systems_count).toBe(2);
      expect(eventData.systems).toEqual(["rendering", "lighting"]);
      expect(eventData.constraints_count).toBe(1);
    });
  });

  describe("trackDiagnosisGenerated", () => {
    it("sends DIAGNOSIS_GENERATED with root cause counts", async () => {
      await trackDiagnosisGenerated({
        diagnosis_id: "d1",
        root_causes: ["bad normals", "missing lightmaps"],
        signals_to_watch_for: ["shadow artifacts"],
        generalization_scope: ["all static meshes"],
      });
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("diagnosis_generated");
      expect(eventData.diagnosis_id).toBe("d1");
      expect(eventData.root_causes_count).toBe(2);
      expect(eventData.signals_count).toBe(1);
      expect(eventData.generalization_scope).toEqual(["all static meshes"]);
    });
  });

  describe("trackLearningPathGenerated", () => {
    it("sends LEARNING_PATH_GENERATED with objective counts", async () => {
      await trackLearningPathGenerated(
        { fix_specific: ["fix lumen"], transferable: ["understand GI", "debug rendering"] },
        [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
        true
      );
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("learning_path_generated");
      expect(eventData.fix_specific_count).toBe(1);
      expect(eventData.transferable_count).toBe(2);
      expect(eventData.course_count).toBe(3);
      expect(eventData.passed_validation).toBe(true);
    });
  });

  describe("trackModuleSkipped", () => {
    it("sends MODULE_SKIPPED with module ID and reason", async () => {
      await trackModuleSkipped("mod1", "already know this");
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("module_skipped");
      expect(eventData.module_id).toBe("mod1");
      expect(eventData.reason).toBe("already know this");
    });
  });

  describe("trackModuleReordered", () => {
    it("sends MODULE_REORDERED with index positions", async () => {
      await trackModuleReordered("mod1", 0, 2);
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("module_reordered");
      expect(eventData.module_id).toBe("mod1");
      expect(eventData.from_index).toBe(0);
      expect(eventData.to_index).toBe(2);
    });
  });

  describe("trackSessionCompleted", () => {
    it("sends SESSION_COMPLETED with mode and summary data", async () => {
      await trackSessionCompleted("problem-first", { courses_watched: 3, total_minutes: 45 });
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("session_completed");
      expect(eventData.mode).toBe("problem-first");
      expect(eventData.courses_watched).toBe(3);
      expect(eventData.total_minutes).toBe(45);
    });
  });

  describe("trackFollowupQuery", () => {
    it("sends FOLLOWUP_QUERY_SUBMITTED with original and followup previews", async () => {
      await trackFollowupQuery("original query preview", "my follow up question about lighting");
      const eventData = mockAddDoc.mock.calls[0][1];
      expect(eventData.event).toBe("followup_query_submitted");
      expect(eventData.original_preview).toBe("original query preview");
      expect(eventData.followup_length).toBe(36);
      expect(eventData.followup_preview).toBe("my follow up question about lighting");
    });
  });

  describe("startSession", () => {
    it("sends SESSION_STARTED and resets session ID", async () => {
      // First call to establish a session
      await trackEvent("warmup");
      const firstSessionId = mockAddDoc.mock.calls[0][1].session_id;

      // startSession should reset and create a new session
      await startSession();
      const eventData = mockAddDoc.mock.calls[1][1];
      expect(eventData.event).toBe("session_started");
      expect(eventData.session_id).not.toBe(firstSessionId);
      expect(eventData.screen_width).toBeDefined();
      expect(eventData.screen_height).toBeDefined();
    });
  });

  // -- Default export --

  describe("default export", () => {
    it("should export all functions", () => {
      expect(analyticsService.EVENTS).toBeDefined();
      expect(typeof analyticsService.trackEvent).toBe("function");
      expect(typeof analyticsService.trackPersonaDetected).toBe("function");
      expect(typeof analyticsService.trackOnboardingPathGenerated).toBe("function");
      expect(typeof analyticsService.trackQuerySubmitted).toBe("function");
      expect(typeof analyticsService.trackIntentExtracted).toBe("function");
      expect(typeof analyticsService.trackDiagnosisGenerated).toBe("function");
      expect(typeof analyticsService.trackLearningPathGenerated).toBe("function");
      expect(typeof analyticsService.trackModuleSkipped).toBe("function");
      expect(typeof analyticsService.trackModuleReordered).toBe("function");
      expect(typeof analyticsService.trackSessionCompleted).toBe("function");
      expect(typeof analyticsService.trackFollowupQuery).toBe("function");
      expect(typeof analyticsService.startSession).toBe("function");
    });
  });
});
