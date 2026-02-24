import { useState, useEffect } from "react";

/**
 * useIsMobile — detects mobile/tablet viewports via matchMedia.
 * Re-evaluates on window resize. SSR-safe (defaults to false).
 *
 * @returns {{ isMobile: boolean, isTablet: boolean }}
 */
export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false
  );
  const [isTablet, setIsTablet] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1024px)").matches : false
  );

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const tabletQuery = window.matchMedia("(max-width: 1024px)");

    const handleMobile = (e) => setIsMobile(e.matches);
    const handleTablet = (e) => setIsTablet(e.matches);

    mobileQuery.addEventListener("change", handleMobile);
    tabletQuery.addEventListener("change", handleTablet);

    return () => {
      mobileQuery.removeEventListener("change", handleMobile);
      tabletQuery.removeEventListener("change", handleTablet);
    };
  }, []);

  return { isMobile, isTablet };
}
