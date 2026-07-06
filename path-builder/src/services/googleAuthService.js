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
let auth = null;
if (app) {
  try {
    auth = getAuth(app);
  } catch (err) {
    console.warn("[GoogleAuth] Auth initialization failed (likely missing API key):", err.message);
  }
}

// Provider — email + profile only (no restricted scopes)
// Drive video embeds use browser cookies, not OAuth tokens
const provider = IS_E2E ? null : new GoogleAuthProvider();
if (provider) provider.setCustomParameters({ prompt: "select_account" });

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
  if (IS_E2E || !auth) return null;
  return auth.currentUser;
}

export default auth;
