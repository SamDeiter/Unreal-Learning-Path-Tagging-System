/**
 * pathCacheService — Cache generated paths by similarity for reuse.
 *
 * - Stores cached paths in localStorage keyed by query text.
 * - Similarity matching: if a new query is close enough to a cached one, serve the cached path.
 * - User history: last 10 paths for "My Learning Paths" review.
 * - TTL: cached paths expire after 90 days.
 */

const CACHE_KEY = "bespoke_path_cache";
const HISTORY_KEY = "bespoke_path_history";
const MAX_CACHE = 50;
const MAX_HISTORY = 10;
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// ── Helpers ────────────────────────────────────────────

/** Normalize query text for comparison */
function normalizeQuery(q) {
  return q
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Simple Jaccard-like word overlap similarity (0-1).
 * Fast client-side alternative to cosine on embeddings.
 * Returns a score where 1 = identical, 0 = no overlap.
 */
function wordSimilarity(a, b) {
  const setA = new Set(normalizeQuery(a).split(" "));
  const setB = new Set(normalizeQuery(b).split(" "));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  // Jaccard index
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ── Cache Operations ───────────────────────────────────

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw);
    // Purge expired entries
    const now = Date.now();
    return entries.filter((e) => now - e.cachedAt < TTL_MS);
  } catch {
    return [];
  }
}

function saveCache(entries) {
  try {
    // Keep only the newest MAX_CACHE entries
    const trimmed = entries.slice(-MAX_CACHE);
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full — silently fail
  }
}

/**
 * Look up a cached path by query similarity.
 * Returns the cached result if similarity >= threshold, or null.
 */
export function findCachedPath(query, threshold = 0.75) {
  const cache = loadCache();
  const norm = normalizeQuery(query);

  // Exact match first
  const exact = cache.find((e) => normalizeQuery(e.query) === norm);
  if (exact) return exact.result;

  // Similarity match
  let bestMatch = null;
  let bestScore = 0;
  for (const entry of cache) {
    const score = wordSimilarity(query, entry.query);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestMatch && bestScore >= threshold) {
    return { ...bestMatch.result, cachedFrom: bestMatch.query, cacheScore: bestScore };
  }

  return null;
}

/**
 * Store a generated path in the cache.
 */
export function cachePath(query, result) {
  const cache = loadCache();
  // Don't cache duplicates
  const norm = normalizeQuery(query);
  const existing = cache.findIndex((e) => normalizeQuery(e.query) === norm);
  if (existing !== -1) {
    cache[existing] = { query, result, cachedAt: Date.now() };
  } else {
    cache.push({ query, result, cachedAt: Date.now() });
  }
  saveCache(cache);
}

// ── User History ───────────────────────────────────────

/**
 * Load user's path history (last 10 paths).
 */
export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Add a path to user history.
 */
export function addToHistory(query, result) {
  const history = loadHistory();
  // Prepend (newest first) and deduplicate
  const norm = normalizeQuery(query);
  const filtered = history.filter((h) => normalizeQuery(h.query) !== norm);
  filtered.unshift({
    query,
    stepCount: result.path?.length || 0,
    generatedAt: result.generatedAt || new Date().toISOString(),
    isPreSeeded: result.isPreSeeded || false,
  });
  // Keep only last MAX_HISTORY
  const trimmed = filtered.slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full
  }
}

/**
 * Clear all cached paths and history.
 */
export function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(HISTORY_KEY);
}

/**
 * Get cache stats for admin dashboard.
 */
export function getCacheStats() {
  const cache = loadCache();
  const history = loadHistory();
  return {
    cachedPaths: cache.length,
    historyCount: history.length,
    oldestCache: cache.length > 0 ? new Date(cache[0].cachedAt).toISOString() : null,
    totalSizeKB: Math.round(
      ((localStorage.getItem(CACHE_KEY) || "").length +
        (localStorage.getItem(HISTORY_KEY) || "").length) /
        1024
    ),
  };
}
