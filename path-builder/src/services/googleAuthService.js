/**
 * Google Auth Service for Drive video access
 * Simple Firebase Google Auth to enable authenticated iframe embeds
 */
import { getFirebaseApp } from "./firebaseConfig";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";


const app = getFirebaseApp();
const auth = getAuth(app);

// Basic provider — email + profile only (no restricted scopes)
// Used by AuthGate for initial sign-in
const basicProvider = new GoogleAuthProvider();
basicProvider.setCustomParameters({ prompt: "select_account" });

// Drive provider — adds drive.readonly for video playback
// Only used when video access is actually needed
const driveProvider = new GoogleAuthProvider();
driveProvider.addScope("https://www.googleapis.com/auth/drive.readonly");
driveProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Sign in with Google popup
 * @returns {Promise<{user: object, error: string | null}>}
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, basicProvider);
    return { user: result.user, error: null };
  } catch (error) {
    console.error("[GoogleAuth] Sign in failed:", error);
    return { user: null, error: error.message };
  }
}

/**
 * Sign in with Google popup + Drive access scope
 * Only call this when video playback is needed
 * @returns {Promise<{user: object, error: string | null}>}
 */
export async function signInWithGoogleDrive() {
  try {
    const result = await signInWithPopup(auth, driveProvider);
    return { user: result.user, error: null };
  } catch (error) {
    console.error("[GoogleAuth] Drive sign in failed:", error);
    return { user: null, error: error.message };
  }
}

/**
 * Sign out
 */
export async function signOutUser() {
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
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current user
 * @returns {object | null}
 */
export function getCurrentUser() {
  return auth.currentUser;
}

export default auth;
