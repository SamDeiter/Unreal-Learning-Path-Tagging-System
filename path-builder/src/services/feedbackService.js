/**
 * Feedback Service — Persists user ratings on search results to localStorage.
 *
 * Stores thumbs up/down per video (identified by driveId) with the query context.
 * Used by the scoring pipeline to demote previously downvoted results.
 *
 * Storage format:
 * {
 *   "feedback_v1": {
 *     "<driveId>": { "up": 0, "down": 1, "lastQuery": "blueprint cast", "lastUpdated": "..." }
 *   }
 * }
 */

import { devLog, devWarn } from "../utils/logger";
import { getFirestore, doc, setDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { getFirebaseApp } from "./firebaseConfig";

const STORAGE_KEY = "feedback_v1";
const DEMOTION_MULTIPLIER = 0.3; // Downvoted videos get 30% of their score
const BOOST_MULTIPLIER = 1.3; // Upvoted videos get 130% of their score

function loadFeedback() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFeedback(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    devWarn("[FeedbackService] Could not save:", e);
  }
}

/**
 * Record a thumbs up for a video result.
 * @param {string} driveId - The video's Drive ID
 * @param {string} query - The search query context
 */
export function recordUpvote(driveId, query) {
  const data = loadFeedback();
  if (!data[driveId]) {
    data[driveId] = { up: 0, down: 0 };
  }
  data[driveId].up += 1;
  data[driveId].down = Math.max(0, data[driveId].down - 1); // Cancel a downvote if present
  data[driveId].lastQuery = query;
  data[driveId].lastUpdated = new Date().toISOString();
  saveFeedback(data);
}

/**
 * Record a thumbs down for a video result.
 * @param {string} driveId - The video's Drive ID
 * @param {string} query - The search query context
 */
export function recordDownvote(driveId, query) {
  const data = loadFeedback();
  if (!data[driveId]) {
    data[driveId] = { up: 0, down: 0 };
  }
  data[driveId].down += 1;
  data[driveId].up = Math.max(0, data[driveId].up - 1); // Cancel an upvote if present
  data[driveId].lastQuery = query;
  data[driveId].lastUpdated = new Date().toISOString();
  saveFeedback(data);
}

/**
 * Get the feedback status for a video.
 * @param {string} driveId
 * @returns {"up"|"down"|null}
 */
export function getFeedbackStatus(driveId) {
  const data = loadFeedback();
  const entry = data[driveId];
  if (!entry) return null;
  if (entry.up > entry.down) return "up";
  if (entry.down > entry.up) return "down";
  return null;
}

/**
 * Apply feedback-based score adjustment to a video's relevance score.
 * Demotes downvoted results, boosts upvoted results.
 * @param {string} driveId
 * @param {number} score - The raw relevance score
 * @returns {number} Adjusted score
 */
export function applyFeedbackMultiplier(driveId, score) {
  const status = getFeedbackStatus(driveId);
  if (status === "down") return Math.round(score * DEMOTION_MULTIPLIER);
  if (status === "up") return Math.round(score * BOOST_MULTIPLIER);
  return score;
}

/**
 * Get feedback stats for analytics/debugging.
 * @returns {{ total: number, upvoted: number, downvoted: number }}
 */
export function getFeedbackStats() {
  const data = loadFeedback();
  const entries = Object.values(data);
  return {
    total: entries.length,
    upvoted: entries.filter((e) => e.up > e.down).length,
    downvoted: entries.filter((e) => e.down > e.up).length,
  };
}

/**
 * Record a form-based feedback submission (bug report, feature request, etc.)
 * Stores in localStorage under a separate key from video feedback.
 * @param {string} type - Feedback type (bug, feature, content, other)
 * @param {string} description - User's description
 * @param {string[]} [fileNames] - Optional attached file names
 * @returns {{ id: string, timestamp: string }}
 */
export function recordFormFeedback(type, description, fileNames = []) {
  const FORM_KEY = "feedback_submissions_v1";
  const entry = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    description,
    fileNames,
    timestamp: new Date().toISOString(),
  };

  try {
    const raw = localStorage.getItem(FORM_KEY);
    const submissions = raw ? JSON.parse(raw) : [];
    submissions.push(entry);
    if (submissions.length > 50) submissions.splice(0, submissions.length - 50);
    localStorage.setItem(FORM_KEY, JSON.stringify(submissions));
  } catch (e) {
    devWarn("[FeedbackService] Could not save form feedback:", e);
  }

  return { id: entry.id, timestamp: entry.timestamp };
}

// ── Firestore-backed watch/skip signals (GuidedPlayer engagement tracking) ──

/**
 * Log a watch/skip feedback signal to Firestore.
 * Fire-and-forget — never blocks the player.
 *
 * @param {string} userId - Authenticated user ID
 * @param {string} courseCode - Course code (e.g., "102.03")
 * @param {string} videoKey - Video key within the course
 * @param {"watched"|"skipped"} signal - Feedback signal type
 * @param {string} [query] - The user's original search query (for context)
 */
export async function logVideoFeedback(userId, courseCode, videoKey, signal, query = "") {
  if (!userId || userId === "anonymous") return;
  try {
    const db = getFirestore(getFirebaseApp());
    const feedbackId = `${courseCode}_${videoKey}_${Date.now()}`;
    const feedbackRef = doc(db, "userFeedback", userId, "videoSignals", feedbackId);
    await setDoc(feedbackRef, {
      courseCode,
      videoKey,
      signal,
      query: String(query).slice(0, 200),
      timestamp: serverTimestamp(),
    });
    devLog(`[Feedback] ${signal} signal for ${courseCode}/${videoKey}`);
  } catch (err) {
    devWarn("[Feedback] Failed to log signal:", err.message);
  }
}

/**
 * Build a boost/penalty map from the user's historical feedback.
 * @param {string} userId - Authenticated user ID
 * @returns {Promise<Map<string, number>>} courseCode → multiplier (>1 = boost, <1 = penalty)
 */
export async function getBoostMap(userId) {
  const boostMap = new Map();
  if (!userId || userId === "anonymous") return boostMap;
  try {
    const db = getFirestore(getFirebaseApp());
    const signalsRef = collection(db, "userFeedback", userId, "videoSignals");
    const snapshot = await getDocs(signalsRef);
    if (snapshot.empty) return boostMap;

    const courseStats = new Map();
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const code = data.courseCode;
      if (!code) continue;
      if (!courseStats.has(code)) courseStats.set(code, { watched: 0, skipped: 0 });
      const stats = courseStats.get(code);
      if (data.signal === "watched") stats.watched++;
      else if (data.signal === "skipped") stats.skipped++;
    }

    for (const [code, stats] of courseStats) {
      const total = stats.watched + stats.skipped;
      if (total < 2) continue; // Need ≥2 signals to be meaningful
      const watchRatio = stats.watched / total;
      boostMap.set(code, 0.7 + watchRatio * 0.5); // 0.7x–1.2x
    }
    devLog(`[Feedback] Boost map: ${boostMap.size} courses with signals`);
    return boostMap;
  } catch (err) {
    devWarn("[Feedback] Failed to build boost map:", err.message);
    return boostMap;
  }
}

export default {
  recordUpvote,
  recordDownvote,
  getFeedbackStatus,
  applyFeedbackMultiplier,
  getFeedbackStats,
  recordFormFeedback,
  logVideoFeedback,
  getBoostMap,
};
