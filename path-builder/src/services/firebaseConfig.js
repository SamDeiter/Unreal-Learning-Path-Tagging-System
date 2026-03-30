/**
 * Firebase Config — Single source of truth for the path-builder app.
 * Import { getFirebaseApp } wherever Firebase is needed.
 *
 * In E2E test mode (VITE_E2E_BYPASS=true) Firebase is never initialized
 * so the CI runner doesn't need VITE_FIREBASE_* secrets.
 */
import { initializeApp, getApps } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
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
  const newApp = initializeApp(firebaseConfig, "path-builder");

  // ── App Check ─────────────────────────────────────────────────────────
  // Requires VITE_RECAPTCHA_SITE_KEY in .env.
  // In dev mode, enable debug mode so localhost isn't blocked.
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    // Enable stable debug token in development — register this token once
    // in Firebase Console → App Check → Debug tokens
    if (import.meta.env.DEV) {
      // @ts-ignore — global flag for Firebase App Check debug mode
      self.FIREBASE_APPCHECK_DEBUG_TOKEN =
        import.meta.env.VITE_APPCHECK_DEBUG_TOKEN ||
        "084BE474-CE46-42CB-8A7C-4CFA5503F14A";
    }
    initializeAppCheck(newApp, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  return newApp;
}
