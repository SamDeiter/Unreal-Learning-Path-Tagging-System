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
const provider = new GoogleAuthProvider();

// Request Drive access scope for video playback
provider.addScope("https://www.googleapis.com/auth/drive.readonly");

/**
 * Sign in with Google popup
 * @returns {Promise<{user: object, error: string | null}>}
 */
export async function signInWithGoogle() {
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
