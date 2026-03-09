/**
 * Struggle Badge Service — Fetches step feedback from Firestore
 * and computes which steps have >30% negative feedback.
 *
 * Returns a Map<stepTitle, { negativePercent, total, negative }>.
 */

import { getFirestore, collection, getDocs, query, limit } from "firebase/firestore";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";

const NEGATIVE_THRESHOLD = 0.3; // 30% negative = struggle badge

/**
 * Fetch step feedback from Firestore and compute struggle badges.
 * Only queries feedback matching the step titles in the current path.
 *
 * @param {Array} steps - The path steps (need .segment.title or .title)
 * @returns {Promise<Map<string, { negativePercent: number, total: number, negative: number }>>}
 */
export async function getStruggleBadges(steps) {
  const badges = new Map();

  try {
    if (!steps || steps.length === 0) return badges;

    const db = getFirestore(getFirebaseApp());
    const feedbackRef = collection(db, "stepFeedback");

    // Get all step titles for matching
    const stepTitles = steps
      .map((s) => s.segment?.title || s.segment?.videoTitle || s.title || "")
      .filter(Boolean);

    if (stepTitles.length === 0) return badges;

    // Query all recent feedback (limited to prevent excessive reads)
    const feedbackQuery = query(feedbackRef, limit(500));
    const snapshot = await getDocs(feedbackQuery);

    if (snapshot.empty) return badges;

    // Aggregate by stepTitle
    const titleStats = new Map();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const title = data.stepTitle;
      if (!title) continue;

      // Only count if this title matches one in the current path
      if (!stepTitles.includes(title)) continue;

      if (!titleStats.has(title)) {
        titleStats.set(title, { positive: 0, negative: 0 });
      }

      const stats = titleStats.get(title);
      if (data.sentiment === "positive") stats.positive++;
      else if (data.sentiment === "negative") stats.negative++;
    }

    // Compute badges for steps above threshold
    for (const [title, stats] of titleStats) {
      const total = stats.positive + stats.negative;
      if (total < 3) continue; // Need ≥3 signals to be meaningful

      const negativeRatio = stats.negative / total;
      if (negativeRatio >= NEGATIVE_THRESHOLD) {
        badges.set(title, {
          negativePercent: Math.round(negativeRatio * 100),
          total,
          negative: stats.negative,
        });
      }
    }

    devLog(`[StruggleBadges] ${badges.size} badges from ${titleStats.size} tracked steps`);
  } catch (err) {
    devWarn("[StruggleBadges] Failed to fetch:", err.message);
  }

  return badges;
}
