import { describe, it, expect } from "vitest";
import { getOSInfo } from "../osUtils";

describe("osUtils", () => {
  it("should return correct MODIFIER_KEY for Mac", () => {
    const info = getOSInfo({ platform: "MacIntel" });
    expect(info.isMac).toBe(true);
    expect(info.MODIFIER_KEY).toBe("⌘");
  });

  it("should return correct MODIFIER_KEY for Windows", () => {
    const info = getOSInfo({ platform: "Win32" });
    expect(info.isMac).toBe(false);
    expect(info.MODIFIER_KEY).toBe("Ctrl");
  });

  it("should handle missing navigator gracefully", () => {
    const info = getOSInfo({});
    expect(info.isMac).toBe(false);
    expect(info.MODIFIER_KEY).toBe("Ctrl");
  });

  it("should support userAgentData.platform", () => {
    const info = getOSInfo({ userAgentData: { platform: "macOS" } });
    expect(info.isMac).toBe(true);
    expect(info.MODIFIER_KEY).toBe("⌘");
  });
});
