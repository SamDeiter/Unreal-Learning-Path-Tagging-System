/**
 * Google Auth Service for Drive video access
 * Simple Firebase Google Auth to enable authenticated iframe embeds
 *
 * In E2E test mode (VITE_E2E_BYPASS=true) all auth calls are no-ops
 * because the AuthGate wrapper skips rendering this code path entirely.
 */
import { getFirebaseApp } from "./firebaseConfig";
import { IS_E2E } from "./e2eBypass";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

// IS_E2E imported from e2eBypass.js (checks both env var and localStorage)

const app = IS_E2E ? null : getFirebaseApp();

// Initialize Auth and Provider with safety checks for CI/E2E
let auth = null;
let provider = null;

if (!IS_E2E && app) {
  try {
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
  } catch (err) {
    console.warn("[GoogleAuth] SDK initialization failed (expected in some CI environments):", err.message);
  }
}

/**
 * Sign in with Google popup
 * @returns {Promise<{user: object, error: string | null}>}
 */
export async function signInWithGoogle() {
  if (IS_E2E) return { user: null, error: null };
  try {
    const result = await signInWithPopup(auth, provider);
    return { user: result.user, error: null };
  } catch (error) {
    console.error("[GoogleAuth] Sign in failed:", error);
    return { user: null, error: error.message };
  }
}

/**
 * Sign out
 */
export async function signOutUser() {
  if (IS_E2E) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("[GoogleAuth] Sign out failed:", error);
  }
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Called with user object or null
 * @returns {Function} Unsubscribe function
 */
export function onAuthChange(callback) {
  if (IS_E2E) return () => {}; // no-op unsubscribe
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current user
 * @returns {object | null}
 */
export function getCurrentUser() {
  if (IS_E2E) return null;
  return auth.currentUser;
}

export default auth;
