/**
 * Utility for OS-aware features (e.g. keyboard shortcuts)
 */

export const isMac =
  typeof window !== "undefined" &&
  (navigator.platform?.toUpperCase().indexOf("MAC") >= 0 ||
    navigator.userAgentData?.platform?.toUpperCase().indexOf("MACOS") >= 0);

export const MODIFIER_KEY = isMac ? "⌘" : "Ctrl";

/**
 * Returns OS info for testing injection
 */
export function getOSInfo(nav = navigator) {
  const mac =
    nav.platform?.toUpperCase().indexOf("MAC") >= 0 ||
    nav.userAgentData?.platform?.toUpperCase().indexOf("MACOS") >= 0;
  return {
    isMac: mac,
    modifierKey: mac ? "⌘" : "Ctrl",
  };
}
