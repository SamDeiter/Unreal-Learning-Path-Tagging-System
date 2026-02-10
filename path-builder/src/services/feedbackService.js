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

import { devWarn } from "../utils/logger";

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

export default {
  recordUpvote,
  recordDownvote,
  getFeedbackStatus,
  applyFeedbackMultiplier,
  getFeedbackStats,
};
