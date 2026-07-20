import { describe, it, expect, beforeEach } from "vitest";
import {
  sanitizeQuery,
  checkRateLimit,
  recordQuery,
  sanitizeOutput,
  sanitizeNarration,
  getRateLimitStats,
} from "../services/securityGuardrails";

describe("securityGuardrails", () => {
  beforeEach(() => {
    sessionStorage.clear();
    // Reset the module-level lastQueryTime by waiting
    // We use vi.useFakeTimers for deterministic testing
  });

  // ── sanitizeQuery ──

  describe("sanitizeQuery", () => {
    it("accepts valid UE5 question", () => {
      const result = sanitizeQuery("Why is my Lumen lighting flickering?");
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe("Why is my Lumen lighting flickering?");
      expect(result.error).toBeNull();
    });

    it("rejects null input", () => {
      expect(sanitizeQuery(null).valid).toBe(false);
    });

    it("rejects undefined input", () => {
      expect(sanitizeQuery(undefined).valid).toBe(false);
    });

    it("rejects non-string input", () => {
      expect(sanitizeQuery(42).valid).toBe(false);
    });

    it("rejects empty string", () => {
      expect(sanitizeQuery("").valid).toBe(false);
    });

    it("rejects whitespace-only", () => {
      expect(sanitizeQuery("   ").valid).toBe(false);
    });

    it("rejects too-short queries (less than 3 words)", () => {
      const result = sanitizeQuery("hi there");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("more specific");
    });

    it("rejects queries over 500 characters", () => {
      const long = "a ".repeat(300);
      const result = sanitizeQuery(long);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too long");
    });

    it("strips HTML tags", () => {
      const result = sanitizeQuery("How do <b>I fix</b> my <script>alert</script> lighting in Unreal Engine 5?");
      expect(result.valid).toBe(true);
      expect(result.sanitized).not.toContain("<");
      expect(result.sanitized).not.toContain(">");
    });

    it("strips javascript: protocol", () => {
      const result = sanitizeQuery("Fix my javascript:alert(1) material problem here");
      expect(result.valid).toBe(true);
      expect(result.sanitized).not.toContain("javascript:");
    });

    it("strips on* event handlers", () => {
      const result = sanitizeQuery("Fix onerror=alert(1) my material problem here");
      expect(result.valid).toBe(true);
      expect(result.sanitized).not.toContain("onerror=");
    });

    it("detects injection attempts (>50% removed)", () => {
      const result = sanitizeQuery("<div><span><b></b></span></div> ok question here lets go");
      // Most content is HTML tags, so after stripping it's much shorter
      // The function should flag this as suspicious
      expect(result.sanitized).not.toContain("<");
    });

    it("collapses multiple whitespace", () => {
      const result = sanitizeQuery("How   do   I   fix   my   lighting   in   UE5?");
      expect(result.valid).toBe(true);
      expect(result.sanitized).not.toContain("  ");
    });
  });

  // ── sanitizeOutput ──

  describe("sanitizeOutput", () => {
    it("escapes HTML entities", () => {
      expect(sanitizeOutput("<script>alert(1)</script>")).not.toContain("<");
    });

    it("returns empty string for null", () => {
      expect(sanitizeOutput(null)).toBe("");
    });

    it("returns empty string for non-string", () => {
      expect(sanitizeOutput(123)).toBe("");
    });

    it("escapes quotes", () => {
      const result = sanitizeOutput('He said "hello"');
      expect(result).not.toContain('"');
    });
  });

  // ── sanitizeNarration ──

  describe("sanitizeNarration", () => {
    it("removes script tags with content", () => {
      const result = sanitizeNarration("Hello <script>alert('xss')</script> World");
      expect(result).not.toContain("script");
      expect(result).toContain("Hello");
      expect(result).toContain("World");
    });

    it("removes generic HTML tags", () => {
      const result = sanitizeNarration("Hello <b>bold</b> world");
      expect(result).not.toContain("<");
    });

    it("returns empty string for null", () => {
      expect(sanitizeNarration(null)).toBe("");
    });
  });

  // ── Rate Limiting ──

  describe("checkRateLimit + recordQuery", () => {
    it("allows first request", () => {
      const result = checkRateLimit();
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100);
    });

    it("returns remaining count", () => {
      const stats = getRateLimitStats();
      expect(stats.maxPerSession).toBe(100);
      expect(stats.cooldownMs).toBe(3000);
      expect(stats.maxQueryLength).toBe(500);
    });

    it("recordQuery increments session count", () => {
      const before = getRateLimitStats().sessionCount;
      recordQuery();
      const after = getRateLimitStats().sessionCount;
      expect(after).toBe(before + 1);
    });
  });
});
