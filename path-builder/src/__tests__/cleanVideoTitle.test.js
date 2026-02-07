/**
 * cleanVideoTitle Utility Tests
 */
import { describe, it, expect } from "vitest";
import { cleanVideoTitle } from "../utils/cleanVideoTitle";

describe("cleanVideoTitle", () => {
  it("returns 'Untitled Video' for falsy input", () => {
    expect(cleanVideoTitle(null)).toBe("Untitled Video");
    expect(cleanVideoTitle(undefined)).toBe("Untitled Video");
    expect(cleanVideoTitle("")).toBe("Untitled Video");
  });

  it("strips .mp4 extension", () => {
    expect(cleanVideoTitle("MyVideo.mp4")).toBe("My Video");
  });

  it("converts underscores to spaces", () => {
    expect(cleanVideoTitle("Main_Lighting_Setup")).toBe("Main Lighting Setup");
  });

  it("strips leading course code (e.g. 100.10)", () => {
    expect(cleanVideoTitle("100.10 MainLighting")).toBe("Main Lighting");
  });

  it("strips leading sequence number", () => {
    expect(cleanVideoTitle("08 MainLightingPartA")).toBe("Main Lighting Part A");
  });

  it("strips trailing number", () => {
    expect(cleanVideoTitle("MainLighting 53")).toBe("Main Lighting");
  });

  it("splits camelCase into separate words", () => {
    expect(cleanVideoTitle("MainLightingPartA")).toBe("Main Lighting Part A");
  });

  it("handles full raw filename pattern", () => {
    expect(cleanVideoTitle("100.10 08 MainLightingPartA 53")).toBe("Main Lighting Part A");
  });

  it("collapses multiple spaces", () => {
    expect(cleanVideoTitle("Main   Lighting")).toBe("Main Lighting");
  });

  it("returns original string when cleaning produces empty", () => {
    expect(cleanVideoTitle("123")).toBe("123");
  });
});
