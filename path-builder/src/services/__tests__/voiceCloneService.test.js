/**
 * voiceCloneService — Unit tests
 *
 * Tests validation logic and config exports.
 * (API calls are tested via integration tests / Cloud Function tests.)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CONFIG } from "../../services/voiceCloneService";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("voiceCloneService", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("CONFIG", () => {
    it("exports valid configuration", () => {
      expect(CONFIG.CLOUD_FUNCTION_BASE).toBe("/api/voice-clone");
      expect(CONFIG.MIN_SAMPLE_DURATION_SEC).toBe(30);
      expect(CONFIG.MAX_SAMPLES).toBe(25);
    });
  });

  describe("createVoiceProfile", () => {
    it("throws for empty samples", async () => {
      const { createVoiceProfile } = await import("../../services/voiceCloneService");
      await expect(createVoiceProfile("instructor1", [])).rejects.toThrow(
        "At least one audio sample is required"
      );
    });

    it("throws for null samples", async () => {
      const { createVoiceProfile } = await import("../../services/voiceCloneService");
      await expect(createVoiceProfile("instructor1", null)).rejects.toThrow(
        "At least one audio sample is required"
      );
    });

    it("throws for too many samples", async () => {
      const { createVoiceProfile } = await import("../../services/voiceCloneService");
      const tooMany = Array(26).fill(new Blob(["audio"]));
      await expect(createVoiceProfile("instructor1", tooMany)).rejects.toThrow(
        "Maximum 25 samples allowed"
      );
    });

    it("sends correct FormData on valid input", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ voiceId: "v123", name: "Test", status: "ready" }),
      });

      const { createVoiceProfile } = await import("../../services/voiceCloneService");
      const samples = [new Blob(["audio1"]), new Blob(["audio2"])];
      const result = await createVoiceProfile("instructor1", samples, { name: "My Voice" });
      expect(result.voiceId).toBe("v123");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("generateSpeech", () => {
    it("throws for empty voiceId", async () => {
      const { generateSpeech } = await import("../../services/voiceCloneService");
      await expect(generateSpeech("", "Hello")).rejects.toThrow("voiceId is required");
    });

    it("throws for empty text", async () => {
      const { generateSpeech } = await import("../../services/voiceCloneService");
      await expect(generateSpeech("v123", "   ")).rejects.toThrow("text is required");
    });

    it("sends correct JSON body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(["audio"])),
      });

      const { generateSpeech } = await import("../../services/voiceCloneService");
      const result = await generateSpeech("v123", "Hello world");
      expect(result).toBeInstanceOf(Blob);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/voice-clone/synthesize",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });
  });
});
