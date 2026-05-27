/**
 * OS Utilities - Centralized platform detection logic
 */

/**
 * Detects OS info from navigator.
 * Supports injection for testing.
 */
export function getOSInfo(nav = typeof navigator !== "undefined" ? navigator : null) {
  if (!nav) {
    return { isMac: false, MODIFIER_KEY: "Ctrl" };
  }

  // Modern browsers
  const platform =
    nav.userAgentData?.platform || nav.platform || "unknown";

  const isMac = /Mac|iPhone|iPod|iPad/i.test(platform);

  return {
    isMac,
    MODIFIER_KEY: isMac ? "⌘" : "Ctrl",
  };
}

const { isMac, MODIFIER_KEY } = getOSInfo();

export { isMac, MODIFIER_KEY };
