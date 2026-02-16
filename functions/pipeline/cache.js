/**
 * Pipeline Sub-Step Cache — Firestore-backed caching with TTL and validation.
 *
 * Each pipeline stage is cached independently using a composite key of:
 * - stage name
 * - normalized query
 * - pipeline mode
 * - prompt_version
 *
 * Cache entries are only reused if they pass Zod schema validation.
 */

const crypto = require("crypto");
const admin = require("firebase-admin");
const { PROMPT_VERSION } = require("./promptVersions");
const { SCHEMAS } = require("./schemas");

const CACHE_COLLECTION = "pipeline_cache";

// TTL in milliseconds
const TTL = {
  intent: 7 * 24 * 60 * 60 * 1000,           // 7 days
  diagnosis: 7 * 24 * 60 * 60 * 1000,         // 7 days
  objectives: 7 * 24 * 60 * 60 * 1000,        // 7 days
  validation: 7 * 24 * 60 * 60 * 1000,        // 7 days
  path_summary_data: 30 * 24 * 60 * 60 * 1000, // 30 days
  micro_lesson: 7 * 24 * 60 * 60 * 1000,      // 7 days
  learning_path: 30 * 24 * 60 * 60 * 1000,    // 30 days
};

/**
 * Generate a deterministic cache key from stage + parameters.
 * @param {string} stage
 * @param {object} keyParams - Fields to include in the hash
 * @returns {string} Cache document ID
 */
function buildCacheKey(stage, keyParams) {
  const payload = JSON.stringify({
    stage,
    prompt_version: PROMPT_VERSION,
    ...keyParams,
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

/**
 * Normalize a query string for cache key consistency.
 */
function normalizeQuery(query) {
  if (!query || typeof query !== "string") return "";
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Attempt to read a cached stage result.
 * Returns the cached data if: exists, not expired, and passes schema validation.
 * Returns null otherwise.
 */
async function getCached(stage, keyParams) {
  try {
    const cacheId = buildCacheKey(stage, keyParams);
    const db = admin.firestore();
    const doc = await db.collection(CACHE_COLLECTION).doc(cacheId).get();

    if (!doc.exists) return null;

    const entry = doc.data();

    // Check TTL
    const ttl = TTL[stage] || TTL.intent;
    const cachedAt = entry.cached_at?.toMillis?.() || entry.cached_at_ms || 0;
    if (Date.now() - cachedAt > ttl) {
      return null; // Expired
    }

    // Validate against schema before returning
    const schema = SCHEMAS[stage];
    if (schema) {
      const result = schema.safeParse(entry.data);
      if (!result.success) {
        console.warn(
          JSON.stringify({
            severity: "WARNING",
            message: "cache_validation_failed",
            stage,
            cache_id: cacheId,
            errors: result.error.issues.map((i) => i.message),
          })
        );
        return null; // Stale schema version or corrupted
      }
      return result.data;
    }

    return entry.data;
  } catch (err) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "cache_read_error",
        stage,
        error: err.message,
      })
    );
    return null;
  }
}

/**
 * Write a stage result to the cache.
 */
async function setCache(stage, keyParams, data) {
  try {
    const cacheId = buildCacheKey(stage, keyParams);
    const db = admin.firestore();
    await db
      .collection(CACHE_COLLECTION)
      .doc(cacheId)
      .set({
        stage,
        prompt_version: PROMPT_VERSION,
        data,
        cached_at: admin.firestore.FieldValue.serverTimestamp(),
        cached_at_ms: Date.now(),
      });
  } catch (err) {
    // Non-fatal — log and continue
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "cache_write_error",
        stage,
        error: err.message,
      })
    );
  }
}

module.exports = {
  buildCacheKey,
  normalizeQuery,
  getCached,
  setCache,
  TTL,
  CACHE_COLLECTION,
};
