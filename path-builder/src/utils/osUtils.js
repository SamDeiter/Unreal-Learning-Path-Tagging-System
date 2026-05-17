/**
 * Utility for OS detection and platform-aware UI strings.
 */

export const isMac =
  typeof window !== "undefined" &&
  (navigator.platform?.toUpperCase().indexOf("MAC") >= 0 ||
    navigator.userAgent?.toUpperCase().indexOf("MAC") >= 0);

/**
 * The primary modifier key name for the current platform.
 * Mac: ⌘ (Command)
 * Others: Ctrl
 */
export const MODIFIER_KEY = isMac ? "⌘" : "Ctrl";
