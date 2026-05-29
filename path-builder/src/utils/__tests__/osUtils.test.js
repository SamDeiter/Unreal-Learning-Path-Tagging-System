import { describe, it, expect } from "vitest";
import { getOSInfo } from "../osUtils";

describe("osUtils", () => {
  it("detects Mac platform correctly", () => {
    const mockNav = { platform: "MacIntel" };
    const info = getOSInfo(mockNav);
    expect(info.isMac).toBe(true);
    expect(info.modifierKey).toBe("⌘");
  });

  it("detects Windows platform correctly", () => {
    const mockNav = { platform: "Win32" };
    const info = getOSInfo(mockNav);
    expect(info.isWindows).toBe(true);
    expect(info.modifierKey).toBe("Ctrl");
  });

  it("detects Linux platform correctly", () => {
    const mockNav = { platform: "Linux x86_64" };
    const info = getOSInfo(mockNav);
    expect(info.isLinux).toBe(true);
    expect(info.modifierKey).toBe("Ctrl");
  });

  it("uses userAgentData if platform is missing", () => {
    const mockNav = {
      userAgentData: { platform: "macOS" }
    };
    const info = getOSInfo(mockNav);
    expect(info.isMac).toBe(true);
    expect(info.modifierKey).toBe("⌘");
  });

  it("falls back to Ctrl for unknown platform", () => {
    const mockNav = { platform: "Unknown" };
    const info = getOSInfo(mockNav);
    expect(info.modifierKey).toBe("Ctrl");
  });
});
