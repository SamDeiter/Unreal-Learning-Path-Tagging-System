/**
 * performanceService — Lightweight client-side timing instrumentation.
 *
 * Usage:
 *   const timer = startTimer("pathGeneration");
 *   // ... do work ...
 *   endTimer(timer); // auto-logs to Firestore
 *
 * Rate-limited to 10 logs/minute to avoid Firestore write storms.
 * No external APM dependencies — all data stays in Firestore.
 */

import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseApp } from "./firebaseConfig";
import { getAuth } from "firebase/auth";

// ── Rate Limiting ──────────────────────────────────────
const MAX_LOGS_PER_MINUTE = 10;
let logCount = 0;
let windowStart = Date.now();

function canLog() {
  const now = Date.now();
  if (now - windowStart > 60000) {
    logCount = 0;
    windowStart = now;
  }
  if (logCount >= MAX_LOGS_PER_MINUTE) return false;
  logCount++;
  return true;
}

// ── Active Timers ──────────────────────────────────────
const activeTimers = new Map();

/**
 * Start a named timer. Returns a timer object to pass to endTimer().
 * @param {string} label — descriptive name (e.g. "pathGeneration", "quizGeneration")
 * @returns {{ label: string, startMs: number }}
 */
export function startTimer(label) {
  const timer = { label, startMs: performance.now() };
  activeTimers.set(label, timer);
  return timer;
}

/**
 * End a timer and log the duration to Firestore.
 * @param {object} timer — timer object from startTimer()
 * @returns {number} duration in milliseconds
 */
export function endTimer(timer) {
  if (!timer || !timer.startMs) return 0;
  const durationMs = Math.round(performance.now() - timer.startMs);
  activeTimers.delete(timer.label);

  // Fire-and-forget Firestore log
  logTiming(timer.label, durationMs);

  return durationMs;
}

/**
 * Manually log a timing measurement.
 * @param {string} label — operation name
 * @param {number} durationMs — duration in milliseconds
 * @param {object} [meta] — optional extra metadata
 */
export async function logTiming(label, durationMs, meta = {}) {
  if (!canLog()) return;

  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);
    const auth = getAuth(app);
    const userId = auth.currentUser?.uid || "anonymous";

    await addDoc(collection(db, "performanceLogs"), {
      label,
      durationMs,
      userId,
      timestamp: serverTimestamp(),
      url: window.location.pathname,
      userAgent: navigator.userAgent.substring(0, 120),
      ...meta,
    });
  } catch {
    // Silently fail — perf logging is non-critical
  }
}

/**
 * Convenience wrapper: time an async function and log the result.
 * @param {string} label — operation name
 * @param {Function} fn — async function to time
 * @returns {Promise<*>} — result of fn()
 */
export async function withTiming(label, fn) {
  const timer = startTimer(label);
  try {
    return await fn();
  } finally {
    endTimer(timer);
  }
}
