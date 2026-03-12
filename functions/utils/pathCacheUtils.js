/**
 * Shared pathCache utility — generates deterministic keys for the cross-user
 * pathCache collection. Mirrors the key logic previously in the client-side
 * pathCacheService.js so backend writes are discoverable by client reads.
 */

const admin = require("firebase-admin");

const PATH_CACHE_COLLECTION = "pathCache";
const PATH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Normalize query text for cache key consistency. */
function normalizeForPathCache(q) {
  return q
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Generate a deterministic cache key matching the client's scheme.
 * Must match pathCacheService.js generateCacheKey() exactly.
 */
function generatePathCacheKey(query, level = "") {
  const norm = normalizeForPathCache(query) + (level ? `_${level}` : "");
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    const chr = norm.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `pc_${Math.abs(hash).toString(36)}`;
}

/**
 * Write a generated path/result to the shared pathCache (backend-only).
 * Strips large fields to keep Firestore docs small.
 * Non-fatal — logs warnings and continues on error.
 */
async function writePathCache(query, result) {
  try {
    const db = admin.firestore();
    const cacheKey = generatePathCacheKey(query);

    // Strip embedding vectors and truncate segment text
    const stripped = {
      ...result,
      path: Array.isArray(result.path)
        ? result.path.map((step) => ({
            ...step,
            segment: step.segment
              ? { ...step.segment, text: (step.segment.text || "").substring(0, 500) }
              : step.segment,
          }))
        : result.path,
      segments: undefined,
    };

    await db.collection(PATH_CACHE_COLLECTION).doc(cacheKey).set({
      query,
      normalizedQuery: normalizeForPathCache(query),
      resultJson: JSON.stringify(stripped),
      cachedAt: admin.firestore.FieldValue.serverTimestamp(),
      cachedAtMs: Date.now(),
      stepCount: result.path?.length || result.steps?.length || 0,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        severity: "WARNING",
        message: "path_cache_write_error",
        error: err.message,
      })
    );
  }
}

module.exports = {
  PATH_CACHE_COLLECTION,
  PATH_CACHE_TTL_MS,
  normalizeForPathCache,
  generatePathCacheKey,
  writePathCache,
};
