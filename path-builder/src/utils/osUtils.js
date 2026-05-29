/**
 * OS Utilities - helpers for platform-aware UI
 */

export function getOSInfo(nav = typeof navigator !== "undefined" ? navigator : {}) {
  const platform = nav.platform?.toLowerCase() || "";
  const userAgentData = nav.userAgentData?.platform?.toLowerCase() || "";

  const isMac = platform.includes("mac") || userAgentData.includes("mac");
  const isWindows = platform.includes("win") || userAgentData.includes("win");
  const isLinux = platform.includes("linux") || userAgentData.includes("linux");

  return {
    isMac,
    isWindows,
    isLinux,
    modifierKey: isMac ? "⌘" : "Ctrl",
  };
}

const osInfo = getOSInfo();
export const isMac = osInfo.isMac;
export const MODIFIER_KEY = osInfo.modifierKey;
