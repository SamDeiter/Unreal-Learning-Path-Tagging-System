/**
 * OS and Browser utility functions
 */

/**
 * Detects the current operating system and returns relevant metadata.
 * Supporting injection for testing purposes.
 *
 * @param {Object} nav - Navigator object (defaults to window.navigator)
 * @returns {Object} { isMac: boolean, MODIFIER_KEY: string }
 */
export function getOSInfo(nav = typeof navigator !== 'undefined' ? navigator : null) {
  const platform = nav?.userAgentData?.platform || nav?.platform || '';
  const isMac = /Mac|iPhone|iPod|iPad/i.test(platform);

  return {
    isMac,
    MODIFIER_KEY: isMac ? '⌘' : 'Ctrl'
  };
}

// Export pre-calculated values for the current environment
const { isMac, MODIFIER_KEY } = getOSInfo();

export { isMac, MODIFIER_KEY };
