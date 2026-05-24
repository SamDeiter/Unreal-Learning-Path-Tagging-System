import { describe, it, expect } from "vitest";
import { getOSInfo } from "../osUtils";

describe("osUtils", () => {
  it("detects Mac platform", () => {
    const mockNav = {
      platform: "MacIntel",
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(true);
    expect(MODIFIER_KEY).toBe("⌘");
  });

  it("detects Windows platform", () => {
    const mockNav = {
      platform: "Win32",
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(false);
    expect(MODIFIER_KEY).toBe("Ctrl");
  });

  it("detects platform from userAgentData", () => {
    const mockNav = {
      userAgentData: {
        platform: "macOS",
      },
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(true);
    expect(MODIFIER_KEY).toBe("⌘");
  });

  it("handles unknown platform", () => {
    const mockNav = {
      platform: "unknown",
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(false);
    expect(MODIFIER_KEY).toBe("Ctrl");
  });

  it("handles null/undefined navigator gracefully", () => {
    const { isMac, MODIFIER_KEY } = getOSInfo(null);
    expect(typeof isMac).toBe("boolean");
    expect(["⌘", "Ctrl"]).toContain(MODIFIER_KEY);
  });
});
