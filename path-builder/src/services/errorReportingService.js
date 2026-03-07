/**
 * Error Reporting Service — Firestore-native production error monitoring.
 *
 * Logs errors to the `errorLogs` Firestore collection with rate limiting
 * and deduplication to prevent spam. Provides visibility into production
 * crashes without requiring external services like Sentry.
 */
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "./firebaseConfig";

// ── Rate limiting ────────────────────────────────────────────────────────────
const MAX_ERRORS_PER_MINUTE = 5;
const DEDUP_WINDOW_MS = 60 * 1000;
let _recentErrors = [];
let _errorCount = 0;
let _lastResetTime = Date.now();

/**
 * Report an error to Firestore for production monitoring.
 *
 * @param {Error|string} error - The error object or message
 * @param {Object} [meta] - Additional context
 * @param {string} [meta.source] - Where the error came from (e.g., "ErrorBoundary", "window.onerror")
 * @param {string} [meta.componentStack] - React component stack (from ErrorBoundary)
 * @param {string} [meta.url] - URL where error occurred
 */
export async function reportError(error, meta = {}) {
  try {
    // Rate limit: max 5 errors per minute to prevent Firestore spam
    const now = Date.now();
    if (now - _lastResetTime > DEDUP_WINDOW_MS) {
      _errorCount = 0;
      _recentErrors = [];
      _lastResetTime = now;
    }

    if (_errorCount >= MAX_ERRORS_PER_MINUTE) {
      console.warn("[errorReporting] Rate limited — too many errors this minute.");
      return;
    }

    // Dedup: skip if we've seen this exact message in the last minute
    const message = error?.message || String(error);
    const errorKey = hashString(message);
    if (_recentErrors.includes(errorKey)) {
      return; // Duplicate — skip
    }
    _recentErrors.push(errorKey);
    _errorCount++;

    // Build the error document
    const auth = getAuth(getFirebaseApp());
    const userId = auth.currentUser?.uid || "anonymous";

    const errorDoc = {
      message: message.slice(0, 500), // Cap length
      stack: (error?.stack || "").slice(0, 2000),
      source: meta.source || "unknown",
      componentStack: (meta.componentStack || "").slice(0, 1000),
      url: meta.url || window.location?.href || "",
      userId,
      userAgent: navigator.userAgent?.slice(0, 300) || "",
      timestamp: serverTimestamp(),
      environment: import.meta.env?.MODE || "production",
    };

    // Write to Firestore
    const db = getFirestore(getFirebaseApp());
    await addDoc(collection(db, "errorLogs"), errorDoc);
  } catch (reportingError) {
    // Never let error reporting crash the app
    console.error("[errorReporting] Failed to report error:", reportingError.message);
  }
}

/**
 * Install global error handlers for uncaught errors and unhandled rejections.
 * Call this once at app startup (e.g., in main.jsx).
 */
export function installGlobalErrorHandlers() {
  // Catch uncaught JS errors
  window.onerror = (message, source, lineno, colno, error) => {
    reportError(error || message, {
      source: "window.onerror",
      url: `${source}:${lineno}:${colno}`,
    });
  };

  // Catch unhandled promise rejections
  window.onunhandledrejection = (event) => {
    const error = event.reason;
    reportError(error, {
      source: "unhandledrejection",
    });
  };
}

/**
 * Simple string hash for deduplication (DJB2 algorithm).
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned
}
