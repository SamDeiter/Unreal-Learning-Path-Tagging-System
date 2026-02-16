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
        })),
      };
    },
  };
}

/**
 * Check if the calling user is an admin.
 * Admin = email ending in @epicgames.com OR UID in ADMIN_UID env var.
 */
function isAdmin(context) {
  if (!context?.auth) return false;

  const email = context.auth.token?.email || "";
  if (email.endsWith("@epicgames.com")) return true;

  const adminUids = (process.env.ADMIN_UID || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminUids.length > 0 && adminUids.includes(context.auth.uid)) return true;

  return false;
}

module.exports = { createTrace, isAdmin };
