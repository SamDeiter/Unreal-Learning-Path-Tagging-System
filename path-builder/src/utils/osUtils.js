/**
 * osUtils - Utility for platform-aware keyboard shortcuts and hints.
 */

export const getOSInfo = (nav = typeof navigator !== "undefined" ? navigator : {}) => {
  const platform = (nav.platform || nav.userAgentData?.platform || "").toUpperCase();
  const isMac = platform.indexOf("MAC") >= 0;
  return {
    isMac,
    MODIFIER_KEY: isMac ? "⌘" : "Ctrl",
  };
};

const defaultInfo = getOSInfo();
export const isMac = defaultInfo.isMac;
export const MODIFIER_KEY = defaultInfo.MODIFIER_KEY;
