import { describe, test, expect } from "vitest";
import { classifyQueryIntent } from "../queryIntentClassifier";

describe("classifyQueryIntent", () => {
  // --- Troubleshooting ---
  test.each([
    ["lumen flickering in my scene", "troubleshooting"],
    ["blueprint compile error on BeginPlay", "troubleshooting"],
    ["crash when opening level", "troubleshooting"],
    ["my material is not working", "troubleshooting"],
    ["access violation in tick function", "troubleshooting"],
    ["low fps in large world", "troubleshooting"],
    ["shadow acne on static meshes", "troubleshooting"],
    ["null pointer in gameplay ability", "troubleshooting"],
  ])('"%s" → %s', (query, expected) => {
    const result = classifyQueryIntent(query);
    expect(result.intent).toBe(expected);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  // --- Learning ---
  test.each([
    ["how to set up Nanite", "learning"],
    ["tutorial for landscape material", "learning"],
    ["best practices for blueprint organization", "learning"],
    ["getting started with world partition", "learning"],
    ["how do I enable Lumen", "learning"],
    ["guide to PCG framework", "learning"],
    ["workflow for character animation", "learning"],
  ])('"%s" → %s', (query, expected) => {
    const result = classifyQueryIntent(query);
    expect(result.intent).toBe(expected);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  // --- Exploring ---
  test.each([
    ["what is Nanite", "exploring"],
    ["difference between Lumen and ray tracing", "exploring"],
    ["compare static and dynamic lighting", "exploring"],
    ["overview of Niagara system", "exploring"],
    ["features of MetaHuman", "exploring"],
  ])('"%s" → %s', (query, expected) => {
    const result = classifyQueryIntent(query);
    expect(result.intent).toBe(expected);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  // --- Edge cases ---
  test("short query with no signals defaults to exploring", () => {
    const result = classifyQueryIntent("nanite");
    expect(result.intent).toBe("exploring");
    expect(result.confidence).toBeLessThan(0.5);
  });

  test("empty query returns exploring with 0 confidence", () => {
    const result = classifyQueryIntent("");
    expect(result.intent).toBe("exploring");
    expect(result.confidence).toBe(0);
  });

  test("null query returns exploring with 0 confidence", () => {
    const result = classifyQueryIntent(null);
    expect(result.intent).toBe("exploring");
    expect(result.confidence).toBe(0);
  });

  test("troubleshooting beats learning when both match", () => {
    const result = classifyQueryIntent("how to fix compile error");
    expect(result.intent).toBe("troubleshooting");
  });

  test("confidence increases with more signal matches", () => {
    const single = classifyQueryIntent("crash");
    const multi = classifyQueryIntent("crash and flicker bug not working");
    expect(multi.confidence).toBeGreaterThan(single.confidence);
  });

  test("confidence is capped at 1.0", () => {
    const result = classifyQueryIntent(
      "error crash bug broken not working fails fix debug flicker artifact"
    );
    expect(result.confidence).toBeLessThanOrEqual(1.0);
  });
});
