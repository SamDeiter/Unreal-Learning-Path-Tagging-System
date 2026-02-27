/**
 * Firebase Config — Single source of truth for the path-builder app.
 * Import { getFirebaseApp } wherever Firebase is needed.
 *
 * In E2E test mode (VITE_E2E_BYPASS=true) Firebase is never initialized
 * so the CI runner doesn't need VITE_FIREBASE_* secrets.
 */
import { initializeApp, getApps } from "firebase/app";
import { IS_E2E } from "./e2eBypass";

// ── E2E stub ──────────────────────────────────────────────────────────────
// When running Playwright tests, the AuthGate is bypassed entirely.
// Return a sentinel object so any accidental Firebase call fails gracefully
// instead of crashing the Vite dev server with misleading errors.
// IS_E2E imported from e2eBypass.js (checks both env var and localStorage)

/** @type {Record<string, string>} */
export const firebaseConfig = IS_E2E
  ? {
      apiKey: "e2e-stub",
      authDomain: "",
      projectId: "e2e-stub",
      storageBucket: "",
      messagingSenderId: "",
      appId: "",
    }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

/**
 * Get or create the "path-builder" Firebase app instance.
 * Reuses the existing app if already initialized.
 * Returns null in E2E mode — callers should guard with `if (!app) return`.
 * @returns {import("firebase/app").FirebaseApp | null}
 */
export function getFirebaseApp() {
  if (IS_E2E) return null;
  const existingApps = getApps();
  const app = existingApps.find((a) => a.name === "path-builder");
  if (app) return app;
  return initializeApp(firebaseConfig, "path-builder");
}
