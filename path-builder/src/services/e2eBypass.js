/**
 * E2E Bypass Detection — shared utility.
 *
 * Two mechanisms (belt-and-suspenders):
 *   1. Vite env var: VITE_E2E_BYPASS=true (works in local dev)
 *   2. localStorage: e2e_auth_bypass=true (reliable in CI via Playwright storageState)
 *
 * In production builds neither is set, so all auth runs normally.
 */

function checkBypass() {
  // 0. Vitest check (runtime)
  // eslint-disable-next-line no-undef
  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") return true;
  // 1. Vite env var (compile-time)
  if (import.meta.env.VITE_E2E_BYPASS === "true") return true;
  // 2. localStorage flag (runtime — set by Playwright storageState)
  if (typeof window !== "undefined") {
    try {
      return window.localStorage.getItem("e2e_auth_bypass") === "true";
    } catch {
      return false; // localStorage blocked (SSR, security policy, etc.)
    }
  }
  return false;
}

/** Cached result — evaluated once at module load time. */
export const IS_E2E = checkBypass();
