/**
 * Firebase Config — Single source of truth for the path-builder app.
 * Import { getFirebaseApp } wherever Firebase is needed.
 */
import { initializeApp, getApps } from "firebase/app";

const firebaseConfig = {
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
 * @returns {import("firebase/app").FirebaseApp}
 */
export function getFirebaseApp() {
  const existingApps = getApps();
  const app = existingApps.find((a) => a.name === "path-builder");
  if (app) return app;
  return initializeApp(firebaseConfig, "path-builder");
}

export { firebaseConfig };
