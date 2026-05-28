import { describe, it, expect } from "vitest";
import { getOSInfo } from "../osUtils";

describe("osUtils", () => {
  it("should detect Mac platforms correctly", () => {
    const macNav = {
      platform: "MacIntel",
      userAgentData: { platform: "macOS" }
    };
    const info = getOSInfo(macNav);
    expect(info.isMac).toBe(true);
    expect(info.modifierKey).toBe("⌘");
  });

  it("should detect Windows platforms correctly", () => {
    const winNav = {
      platform: "Win32",
      userAgentData: { platform: "Windows" }
    };
    const info = getOSInfo(winNav);
    expect(info.isMac).toBe(false);
    expect(info.modifierKey).toBe("Ctrl");
  });

  it("should handle missing userAgentData", () => {
    const oldMacNav = {
      platform: "MacIntel"
    };
    const info = getOSInfo(oldMacNav);
    expect(info.isMac).toBe(true);
    expect(info.modifierKey).toBe("⌘");
  });

  it("should handle empty navigator", () => {
    const info = getOSInfo({});
    expect(info.isMac).toBe(false);
    expect(info.modifierKey).toBe("Ctrl");
  });
});
