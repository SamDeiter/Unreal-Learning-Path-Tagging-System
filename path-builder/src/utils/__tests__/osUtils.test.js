import { describe, it, expect } from "vitest";
import { getOSInfo } from "../osUtils";

describe("osUtils", () => {
  it("should detect Mac and return ⌘ as MODIFIER_KEY", () => {
    const mockNav = {
      platform: "MacIntel",
      userAgentData: { platform: "macOS" }
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(true);
    expect(MODIFIER_KEY).toBe("⌘");
  });

  it("should detect Windows and return Ctrl as MODIFIER_KEY", () => {
    const mockNav = {
      platform: "Win32",
      userAgentData: { platform: "Windows" }
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(false);
    expect(MODIFIER_KEY).toBe("Ctrl");
  });

  it("should detect Linux and return Ctrl as MODIFIER_KEY", () => {
    const mockNav = {
      platform: "Linux x86_64",
      userAgentData: { platform: "Linux" }
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(false);
    expect(MODIFIER_KEY).toBe("Ctrl");
  });

  it("should handle missing navigator and fallback to Ctrl", () => {
    const { isMac, MODIFIER_KEY } = getOSInfo(null);
    expect(isMac).toBe(false);
    expect(MODIFIER_KEY).toBe("Ctrl");
  });

  it("should use legacy platform if userAgentData is missing", () => {
    const mockNav = {
      platform: "MacIntel"
    };
    const { isMac, MODIFIER_KEY } = getOSInfo(mockNav);
    expect(isMac).toBe(true);
    expect(MODIFIER_KEY).toBe("⌘");
  });
});
