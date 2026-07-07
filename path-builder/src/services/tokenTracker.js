/**
 * Token & Cost Tracking for Bespoke Learning Paths
 *
 * Tracks Gemini API usage across all bespoke path operations:
 * - Query embedding
 * - Vector search
 * - Path sequencing (extractIntent)
 * - Bridge narration
 * - Quiz generation
 * - Step audio briefings
 * - Step takeaways
 *
 * Data is stored in both localStorage (fast cache) and
 * Firestore (persistent cloud storage for historical trends).
 *
 * Gemini 2.0 Flash pricing:
 *   Input:  $0.10 / 1M tokens
 *   Output: $0.40 / 1M tokens
 */

import {
  getFirestore,
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { getFirebaseApp } from "./firebaseConfig";
import { getCurrentUser } from "./googleAuthService";

const TRACKER_KEY = "bespoke_token_tracker";
const DAILY_BUDGET_ALERT = 10.0; // $10/day threshold

// Gemini 2.0 Flash pricing (per token)
const PRICING = {
  inputPerToken: 0.1 / 1_000_000, // $0.10 per 1M input tokens
  outputPerToken: 0.4 / 1_000_000, // $0.40 per 1M output tokens
};

// ── Core Tracking ──────────────────────────────────────

/**
 * Record tokens used for a single API call.
 * @param {string} operation - e.g. 'embedQuery', 'sequencePath', 'generateQuiz'
 * @param {number} inputTokens - tokens sent to Gemini
 * @param {number} outputTokens - tokens received from Gemini
 */
export function recordTokenUsage(operation, inputTokens = 0, outputTokens = 0) {
  const tracker = loadTracker();
  const today = getTodayKey();

  if (!tracker.daily[today]) {
    tracker.daily[today] = { totalInput: 0, totalOutput: 0, calls: 0, operations: {} };
  }

  const day = tracker.daily[today];
  day.totalInput += inputTokens;
  day.totalOutput += outputTokens;
  day.calls += 1;

  if (!day.operations[operation]) {
    day.operations[operation] = { input: 0, output: 0, calls: 0 };
  }
  day.operations[operation].input += inputTokens;
  day.operations[operation].output += outputTokens;
  day.operations[operation].calls += 1;

  // Lifetime totals
  tracker.lifetime.totalInput += inputTokens;
  tracker.lifetime.totalOutput += outputTokens;
  tracker.lifetime.totalCalls += 1;

  // Check budget alert
  const dailyCost = estimateCost(day.totalInput, day.totalOutput);
  if (dailyCost >= DAILY_BUDGET_ALERT) {
    console.warn(
      `[BESPOKE] budget_alert daily_cost=$${dailyCost.toFixed(4)} threshold=$${DAILY_BUDGET_ALERT}`
    );
    tracker.budgetAlertTriggered = true;
  }

  saveTracker(tracker);

  // Sync to Firestore (fire-and-forget, non-blocking)
  syncDayToFirestore(today, day).catch(() => {});
}

/**
 * Record a full path generation's token usage.
 * Convenience wrapper that records multiple operations at once.
 */
export function recordPathGeneration(tokenBreakdown) {
  const {
    embedding = { input: 0, output: 0 },
    vectorSearch = { input: 0, output: 0 },
    sequencing = { input: 0, output: 0 },
    narration = { input: 0, output: 0 },
    quiz = { input: 0, output: 0 },
  } = tokenBreakdown;

  if (embedding.input || embedding.output) {
    recordTokenUsage("embedQuery", embedding.input, embedding.output);
  }
  if (vectorSearch.input || vectorSearch.output) {
    recordTokenUsage("vectorSearch", vectorSearch.input, vectorSearch.output);
  }
  if (sequencing.input || sequencing.output) {
    recordTokenUsage("sequencePath", sequencing.input, sequencing.output);
  }
  if (narration.input || narration.output) {
    recordTokenUsage("bridgeNarration", narration.input, narration.output);
  }
  if (quiz.input || quiz.output) {
    recordTokenUsage("quizGeneration", quiz.input, quiz.output);
  }
}

// ── Cost Estimation ────────────────────────────────────

/**
 * Estimate cost from token counts.
 */
export function estimateCost(inputTokens, outputTokens) {
  return inputTokens * PRICING.inputPerToken + outputTokens * PRICING.outputPerToken;
}

/**
 * Estimate cost for a typical path generation.
 * Based on average observed token usage.
 */
export function estimatePathCost() {
  // Typical path: ~2000 input tokens, ~500 output tokens across all calls
  const avgInput = 2000;
  const avgOutput = 500;
  return estimateCost(avgInput, avgOutput);
}

// ── Stats & Dashboard ──────────────────────────────────

/**
 * Get comprehensive stats for admin dashboard.
 */
export function getTokenStats() {
  const tracker = loadTracker();
  const today = getTodayKey();
  const todayData = tracker.daily[today] || {
    totalInput: 0,
    totalOutput: 0,
    calls: 0,
    operations: {},
  };

  const dailyCost = estimateCost(todayData.totalInput, todayData.totalOutput);
  const lifetimeCost = estimateCost(tracker.lifetime.totalInput, tracker.lifetime.totalOutput);

  // Last 7 days
  const last7Days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = formatDateKey(date);
    const dayData = tracker.daily[key];
    last7Days.push({
      date: key,
      input: dayData?.totalInput || 0,
      output: dayData?.totalOutput || 0,
      calls: dayData?.calls || 0,
      cost: dayData ? estimateCost(dayData.totalInput, dayData.totalOutput) : 0,
    });
  }

  return {
    today: {
      inputTokens: todayData.totalInput,
      outputTokens: todayData.totalOutput,
      calls: todayData.calls,
      cost: dailyCost,
      costFormatted: `$${dailyCost.toFixed(4)}`,
      operations: todayData.operations,
      budgetRemaining: Math.max(0, DAILY_BUDGET_ALERT - dailyCost),
      budgetPercent: Math.min(100, (dailyCost / DAILY_BUDGET_ALERT) * 100),
    },
    lifetime: {
      inputTokens: tracker.lifetime.totalInput,
      outputTokens: tracker.lifetime.totalOutput,
      calls: tracker.lifetime.totalCalls,
      cost: lifetimeCost,
      costFormatted: `$${lifetimeCost.toFixed(4)}`,
    },
    last7Days,
    budgetAlertTriggered: tracker.budgetAlertTriggered || false,
    avgCostPerPath:
      tracker.lifetime.totalCalls > 0
        ? lifetimeCost / tracker.lifetime.totalCalls
        : estimatePathCost(),
  };
}

/**
 * Check if daily budget is exceeded.
 */
export function isDailyBudgetExceeded() {
  const tracker = loadTracker();
  const today = getTodayKey();
  const todayData = tracker.daily[today];
  if (!todayData) return false;
  return estimateCost(todayData.totalInput, todayData.totalOutput) >= DAILY_BUDGET_ALERT;
}

/**
 * Reset tracking data (admin only).
 */
export function resetTokenTracker() {
  localStorage.removeItem(TRACKER_KEY);
}

// ── Firestore Cloud Sync ──────────────────────────────

/**
 * Sync a day's token data to Firestore for persistent storage.
 * Writes to: token_usage/{date}
 */
async function syncDayToFirestore(dateKey, dayData) {
  try {
    const app = getFirebaseApp();
    if (!app) return;

    const user = getCurrentUser();
    if (!user) return;

    const db = getFirestore(app);
    const docRef = doc(db, "users", user.uid, "token_usage", dateKey);
    await setDoc(
      docRef,
      {
        date: dateKey,
        totalInput: dayData.totalInput,
        totalOutput: dayData.totalOutput,
        calls: dayData.calls,
        operations: dayData.operations,
        estimatedCost: estimateCost(dayData.totalInput, dayData.totalOutput),
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    // Don't let sync failures break the app
    console.warn("[TokenTracker] Firestore sync failed:", err.message);
  }
}

/**
 * Fetch historical token usage from Firestore.
 * @param {number} days - Number of days to fetch (default 30)
 * @returns {Promise<Array>} Array of daily usage records
 */
export async function fetchCloudStats(days = 30) {
  try {
    const app = getFirebaseApp();
    if (!app) return [];

    const user = getCurrentUser();
    if (!user) return [];

    const db = getFirestore(app);
    const q = query(
      collection(db, "users", user.uid, "token_usage"),
      orderBy("date", "desc"),
      limit(days)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[TokenTracker] Failed to fetch cloud stats:", err.message);
    return [];
  }
}

// ── Firestore R/W Cost Tracking ───────────────────────

// Firebase Firestore Blaze Plan pricing
export const FIRESTORE_PRICING = {
  readPer100K: 0.06, // $0.06 per 100K reads
  writePer100K: 0.18, // $0.18 per 100K writes
  deletePer100K: 0.02, // $0.02 per 100K deletes
};

/**
 * Estimate Firestore cost from read/write counts.
 */
export function estimateFirestoreCost(reads, writes) {
  return (
    (reads / 100_000) * FIRESTORE_PRICING.readPer100K +
    (writes / 100_000) * FIRESTORE_PRICING.writePer100K
  );
}

/**
 * Fetch Firestore R/W usage from the apiUsage collection.
 * Aggregates firestoreReads and firestoreWrites logged by Cloud Functions.
 * @param {number} days - Number of days to look back
 * @returns {Promise<{totalReads, totalWrites, estimatedCost, byFunction}>}
 */
export async function fetchFirestoreUsage(days = 7) {
  try {
    const app = getFirebaseApp();
    if (!app) return null;
    const db = getFirestore(app);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const q = query(
      collection(db, "apiUsage"),
      orderBy("timestamp", "desc"),
      limit(500) // Cap to avoid reading too many docs
    );
    const snapshot = await getDocs(q);

    let totalReads = 0;
    let totalWrites = 0;
    const byFunction = {};

    snapshot.docs.forEach((d) => {
      const data = d.data();
      const reads = data.firestoreReads || 0;
      const writes = data.firestoreWrites || 0;
      totalReads += reads;
      totalWrites += writes;

      const fn = data.function || data.type || "unknown";
      if (!byFunction[fn]) {
        byFunction[fn] = { reads: 0, writes: 0, calls: 0 };
      }
      byFunction[fn].reads += reads;
      byFunction[fn].writes += writes;
      byFunction[fn].calls += 1;
    });

    return {
      totalReads,
      totalWrites,
      totalOps: totalReads + totalWrites,
      estimatedCost: estimateFirestoreCost(totalReads, totalWrites),
      costFormatted: `$${estimateFirestoreCost(totalReads, totalWrites).toFixed(6)}`,
      byFunction,
      docsScanned: snapshot.size,
    };
  } catch (err) {
    console.warn("[TokenTracker] Failed to fetch Firestore usage:", err.message);
    return null;
  }
}

// ── Internal ───────────────────────────────────────────

function loadTracker() {
  try {
    const raw = localStorage.getItem(TRACKER_KEY);
    if (!raw) return createEmptyTracker();
    const tracker = JSON.parse(raw);
    // Prune entries older than 30 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffKey = formatDateKey(cutoff);
    for (const key of Object.keys(tracker.daily)) {
      if (key < cutoffKey) delete tracker.daily[key];
    }
    return tracker;
  } catch {
    return createEmptyTracker();
  }
}

function saveTracker(tracker) {
  try {
    localStorage.setItem(TRACKER_KEY, JSON.stringify(tracker));
  } catch {
    // localStorage full
  }
}

function createEmptyTracker() {
  return {
    daily: {},
    lifetime: { totalInput: 0, totalOutput: 0, totalCalls: 0 },
    budgetAlertTriggered: false,
  };
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10); // "2026-03-03"
}
