import { useSyncExternalStore } from "react";

/**
 * useIsMobile — detects mobile/tablet viewports via matchMedia.
 * Uses useSyncExternalStore for tear-free reads that stay in sync
 * across HMR reloads and React re-mounts.
 *
 * @returns {{ isMobile: boolean, isTablet: boolean }}
 */

function createMediaQuery(query) {
  const mql = typeof window !== "undefined" ? window.matchMedia(query) : null;

  function subscribe(callback) {
    if (!mql) return () => {};
    mql.addEventListener("change", callback);
    return () => mql.removeEventListener("change", callback);
  }

  function getSnapshot() {
    return mql ? mql.matches : false;
  }

  function getServerSnapshot() {
    return false;
  }

  return { subscribe, getSnapshot, getServerSnapshot };
}

const mobileStore = createMediaQuery("(max-width: 768px)");
const tabletStore = createMediaQuery("(max-width: 1024px)");

export default function useIsMobile() {
  const isMobile = useSyncExternalStore(
    mobileStore.subscribe,
    mobileStore.getSnapshot,
    mobileStore.getServerSnapshot,
  );
  const isTablet = useSyncExternalStore(
    tabletStore.subscribe,
    tabletStore.getSnapshot,
    tabletStore.getServerSnapshot,
  );

  return { isMobile, isTablet };
}
