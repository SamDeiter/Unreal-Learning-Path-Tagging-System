/**
 * Google Auth Service for Drive video access
 * Simple Firebase Google Auth to enable authenticated iframe embeds
 */
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

// Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Get or create Firebase app
function getFirebaseApp() {
  const existingApps = getApps();
  const app = existingApps.find((a) => a.name === "path-builder");
  if (app) return app;
  return initializeApp(firebaseConfig, "path-builder");
}

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
