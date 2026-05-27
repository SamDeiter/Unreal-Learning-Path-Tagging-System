import { describe, it, expect, vi } from "vitest";
import { getOSInfo } from "../osUtils";

describe("osUtils", () => {
  it("detects Mac platform from userAgentData", () => {
    const mockNav = {
      userAgentData: { platform: "macOS" }
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(true);
    expect(MODIFIER_KEY).toBe("⌘");
  });

  it("detects Mac platform from legacy navigator.platform", () => {
    const mockNav = {
      platform: "MacIntel"
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(true);
    expect(MODIFIER_KEY).toBe("⌘");
  });

  it("detects Windows platform", () => {
    const mockNav = {
      userAgentData: { platform: "Windows" }
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(false);
    expect(MODIFIER_KEY).toBe("Ctrl");
  });

  it("handles null navigator gracefully", () => {
    const { isMac, MODIFIER_KEY } = getOSInfo(null);
    expect(isMac).toBe(false);
    expect(MODIFIER_KEY).toBe("Ctrl");
  });

  it("handles unknown platforms", () => {
    const mockNav = {
      platform: "unknown"
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(false);
    expect(MODIFIER_KEY).toBe("Ctrl");
  });
});
