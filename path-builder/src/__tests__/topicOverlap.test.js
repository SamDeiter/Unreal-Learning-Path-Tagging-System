import { describe, it, expect } from "vitest";
import { computeTopicOverlap } from "../services/bespokePathService";

/**
 * Unit tests for computeTopicOverlap — the code-level guardrail that
 * rejects semantically-similar but topically-wrong RAG results.
 *
 * These are the known false-match pairs that prompted the fix:
 * - "time dilation" query → "delay nodes" content  (should reject)
 * - "physics simulation" query → "animation physics" content (should reject)
 */

describe("computeTopicOverlap", () => {
  // ── Should PASS (topically relevant) ──

  it("returns high overlap for exact match", () => {
    const overlap = computeTopicOverlap(
      "time dilation effect",
      "Set Time Dilation lets you slow down or speed up the world time dilation effect"
    );
    expect(overlap).toBeGreaterThanOrEqual(0.3);
  });

  it("returns high overlap for related Blueprint content", () => {
    const overlap = computeTopicOverlap(
      "Blueprint interfaces in UE5",
      "Blueprint Interfaces allow communication between different Blueprints. Create a new Blueprint Interface from the Content Browser."
    );
    expect(overlap).toBeGreaterThanOrEqual(0.3);
  });

  it("returns high overlap for closely matching topic", () => {
    const overlap = computeTopicOverlap(
      "How to set up Nanite",
      "Enabling Nanite on your static meshes. Nanite setup in Project Settings."
    );
    expect(overlap).toBeGreaterThanOrEqual(0.3);
  });

  // ── Should FAIL (topically wrong, semantically similar) ──

  it("rejects delay nodes for time dilation query", () => {
    const overlap = computeTopicOverlap(
      "time dilation",
      "Use Delay nodes to pause Blueprint execution for a specified duration. The Delay node stops the execution flow."
    );
    expect(overlap).toBeLessThan(0.3);
  });

  it("rejects animation physics for physics simulation query", () => {
    const overlap = computeTopicOverlap(
      "physics simulation rigid body",
      "Animation physics ragdoll setup. Enable physics on skeletal mesh bones for ragdoll animation."
    );
    expect(overlap).toBeLessThan(0.3);
  });

  it("rejects Blueprint communication for networking query", () => {
    const overlap = computeTopicOverlap(
      "networking multiplayer replication",
      "Actor communication in Blueprints. Use event dispatchers to send messages between actors."
    );
    expect(overlap).toBeLessThan(0.3);
  });

  // ── Edge cases ──

  it("returns 0 for empty inputs", () => {
    expect(computeTopicOverlap("", "some text")).toBe(0);
    expect(computeTopicOverlap("hello", "")).toBe(0);
    expect(computeTopicOverlap(null, null)).toBe(0);
  });

  it("returns 1 for trivial (all stop words) query", () => {
    expect(computeTopicOverlap("how to use", "anything here")).toBe(1);
  });

  it("ignores punctuation", () => {
    const overlap = computeTopicOverlap(
      "what's Nanite?",
      "Nanite is a virtualized geometry system"
    );
    expect(overlap).toBeGreaterThanOrEqual(0.3);
  });
});
