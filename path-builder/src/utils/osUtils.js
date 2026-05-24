export const getOSInfo = (nav = globalThis.navigator) => {
  const platform =
    nav?.userAgentData?.platform || nav?.platform || "unknown";
  const isMac = /Mac|iPhone|iPod|iPad/i.test(platform);
  return {
    isMac,
    MODIFIER_KEY: isMac ? "⌘" : "Ctrl",
  };
};

const { isMac, MODIFIER_KEY } = getOSInfo();
export { isMac, MODIFIER_KEY };
