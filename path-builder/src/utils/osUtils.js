/**
 * OS Utilities — Centralized platform detection for UI hints and shortcuts.
 */

// Basic platform check
export const isMac =
  typeof window !== "undefined" &&
  (navigator.platform?.toUpperCase().indexOf("MAC") >= 0 ||
    navigator.userAgentData?.platform?.toUpperCase().indexOf("MACOS") >= 0);

// Platform-appropriate modifier key label
export const MODIFIER_KEY = isMac ? "⌘" : "Ctrl";

/**
 * getOSInfo — returns platform details for testing/debugging.
 * @param {Object} nav - optional navigator override for testing
 */
export function getOSInfo(nav = typeof navigator !== "undefined" ? navigator : {}) {
  const platform = nav.platform || "";
  const uaData = nav.userAgentData?.platform || "";
  const isMacPlatform =
    platform.toUpperCase().indexOf("MAC") >= 0 || uaData.toUpperCase().indexOf("MACOS") >= 0;

  return {
    isMac: isMacPlatform,
    modifierKey: isMacPlatform ? "⌘" : "Ctrl",
  };
}
