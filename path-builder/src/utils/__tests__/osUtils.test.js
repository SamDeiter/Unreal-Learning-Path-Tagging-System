import { describe, it, expect } from "vitest";
import { getOSInfo } from "../osUtils";

describe("osUtils", () => {
  it("detects Mac platform correctly", () => {
    const mockNav = {
      platform: "MacIntel",
      userAgentData: { platform: "macOS" },
    };
    const { isMac, modifierKey } = getOSInfo(mockNav);
    expect(isMac).toBe(true);
    expect(modifierKey).toBe("⌘");
  });

  it("detects Windows platform correctly", () => {
    const mockNav = {
      platform: "Win32",
      userAgentData: { platform: "Windows" },
    };
    const { isMac, modifierKey } = getOSInfo(mockNav);
    expect(isMac).toBe(false);
    expect(modifierKey).toBe("Ctrl");
  });

  it("handles missing userAgentData", () => {
    const mockNav = {
      platform: "Win32",
    };
    const { isMac, modifierKey } = getOSInfo(mockNav);
    expect(isMac).toBe(false);
    expect(modifierKey).toBe("Ctrl");
  });

  it("detects Mac via platform only", () => {
    const mockNav = {
      platform: "Macintosh",
    };
    const { isMac, modifierKey } = getOSInfo(mockNav);
    expect(isMac).toBe(true);
    expect(modifierKey).toBe("⌘");
  });
});
