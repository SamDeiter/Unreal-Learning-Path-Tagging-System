/**
 * Token & Cost Tracking for Bespoke Learning Paths
 *
 * Tracks Gemini API usage across all bespoke path operations:
 * - Query embedding
 * - Vector search
 * - Path sequencing (extractIntent)
 * - Bridge narration
 * - Quiz generation
 *
 * Gemini 2.0 Flash pricing:
 *   Input:  $0.10 / 1M tokens
 *   Output: $0.40 / 1M tokens
 */

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
