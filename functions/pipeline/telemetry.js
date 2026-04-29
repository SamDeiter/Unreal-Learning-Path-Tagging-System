/**
 * Pipeline Telemetry — structured tracing for every LLM request.
 *
 * Provides:
 * - Unique request_id per invocation
 * - Per-stage timing (ms), retry count, cache hit/miss
 * - Model + prompt_version recording
 * - Admin-only debug payload
 */

const crypto = require("crypto");
const { PROMPT_VERSION } = require("./promptVersions");

// Lazy-load firebase-admin's Firestore so this module stays importable in
// contexts that haven't initialized admin yet (tests, scripts).
let _admin = null;
function getAdmin() {
  if (!_admin) {
    // eslint-disable-next-line global-require
    _admin = require("firebase-admin");
  }
  return _admin;
}

/**
 * Increment token-usage counters for a stage in today's daily rollup doc.
 *
 * Writes to `usage_metrics/{YYYY-MM-DD}` using FieldValue.increment so concurrent
 * requests stay correct. Fire-and-forget — callers should NOT await this in the
 * request hot path. Always pass `.catch(console.error)`.
 *
 * @param {object} params
 * @param {string} params.stage             Stage name (e.g. "diagnosis")
 * @param {number} [params.promptTokens]    Default 0
 * @param {number} [params.candidatesTokens] Default 0
 * @param {number} [params.cachedTokens]    Default 0
 * @param {boolean} [params.error]          If true, increment errors.<stage> and skip token counters
 * @returns {Promise<void>}
 */
async function recordUsageRollup({
  stage,
  promptTokens = 0,
  candidatesTokens = 0,
  cachedTokens = 0,
  error = false,
} = {}) {
  if (!stage) return;
  const admin = getAdmin();
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  // YYYY-MM-DD in UTC so daily buckets line up regardless of caller timezone.
  const todayId = new Date().toISOString().slice(0, 10);
  const docRef = db.collection("usage_metrics").doc(todayId);

  if (error) {
    await docRef.set(
      {
        errors: { [stage]: FieldValue.increment(1) },
        totals: { errorCount: FieldValue.increment(1) },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return;
  }

  await docRef.set(
    {
      stages: {
        [stage]: {
          promptTokens: FieldValue.increment(promptTokens),
          candidatesTokens: FieldValue.increment(candidatesTokens),
          cachedTokens: FieldValue.increment(cachedTokens),
          requestCount: FieldValue.increment(1),
        },
      },
      totals: {
        promptTokens: FieldValue.increment(promptTokens),
        candidatesTokens: FieldValue.increment(candidatesTokens),
        cachedTokens: FieldValue.increment(cachedTokens),
        requestCount: FieldValue.increment(1),
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Create a new trace for a pipeline invocation.
 * @param {string} userId - The authenticated user ID
 * @param {string} mode - Pipeline mode ("problem-first" | "onboarding" | etc.)
 * @returns {Trace}
 */
function createTrace(userId, mode) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  const stages = [];
  let _currentStage = null;

  return {
    request_id: requestId,

    /**
     * Mark the start of a pipeline stage.
     */
    startStage(stageName) {
      _currentStage = {
        stage: stageName,
        started_at: Date.now(),
        ended_at: null,
        duration_ms: null,
        retries: 0,
        cache_hit: false,
        model: null,
        prompt_version: PROMPT_VERSION,
        error: null,
      };
    },

    /**
     * Mark the end of the current stage with metadata.
     */
    endStage(meta = {}) {
      if (!_currentStage) return;
      _currentStage.ended_at = Date.now();
      _currentStage.duration_ms = _currentStage.ended_at - _currentStage.started_at;
      Object.assign(_currentStage, meta);
      stages.push({ ..._currentStage });
      _currentStage = null;
    },

    /**
     * Record a retry on the current stage.
     */
    recordRetry() {
      if (_currentStage) _currentStage.retries += 1;
    },

    /**
     * Record a cache hit on the current stage.
     */
    recordCacheHit() {
      if (_currentStage) _currentStage.cache_hit = true;
    },

    /**
     * Attach Gemini token-usage numbers to the current stage record so they
     * surface in the admin _debug payload. Purely additive — does not alter
     * existing fields.
     *
     * @param {object} usage
     * @param {number} [usage.promptTokens=0]
     * @param {number} [usage.candidatesTokens=0]
     * @param {number} [usage.cachedTokens=0]
     */
    recordTokenUsage({ promptTokens = 0, candidatesTokens = 0, cachedTokens = 0 } = {}) {
      if (!_currentStage) return;
      _currentStage.tokenUsage = {
        promptTokens,
        candidatesTokens,
        cachedTokens,
      };
    },

    /**
     * Write structured log to Cloud Functions stdout.
     */
    toLog() {
      const totalMs = Date.now() - startTime;
      const logEntry = {
        severity: "INFO",
        message: "pipeline_trace",
        request_id: requestId,
        user_id: userId,
        mode,
        prompt_version: PROMPT_VERSION,
        total_duration_ms: totalMs,
        stages: stages.map((s) => ({
          stage: s.stage,
          duration_ms: s.duration_ms,
          retries: s.retries,
          cache_hit: s.cache_hit,
          model: s.model,
          error: s.error,
        })),
      };
      // Structured JSON log for Cloud Logging
      console.log(JSON.stringify(logEntry));
    },

    /**
     * Produce a debug payload for admin callers.
     * Excludes sensitive info. Only return this to admin users.
     */
    toDebugPayload() {
      return {
        request_id: requestId,
        prompt_version: PROMPT_VERSION,
        mode,
        total_duration_ms: Date.now() - startTime,
        stages: stages.map((s) => ({
          stage: s.stage,
          duration_ms: s.duration_ms,
          retries: s.retries,
          cache_hit: s.cache_hit,
          model: s.model,
          error: s.error || null,
          tokenUsage: s.tokenUsage || null,
        })),
      };
    },
  };
}

/**
 * Check if the calling user is an admin.
 * Primary: Firebase custom claim `admin: true`
 * Fallback: UID in ADMIN_UID env var (for migration period)
 */
function isAdmin(context) {
  if (!context?.auth) return false;

  // Custom claim check (primary — set via setAdminClaim Cloud Function)
  if (context.auth.token?.admin === true) return true;

  // UID fallback (for migration period before claims are seeded)
  const adminUids = (process.env.ADMIN_UID || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminUids.length > 0 && adminUids.includes(context.auth.uid)) return true;

  return false;
}

module.exports = { createTrace, isAdmin, recordUsageRollup };
