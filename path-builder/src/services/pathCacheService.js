/**
 * pathCacheService — Dual-layer cache for generated learning paths.
 *
 * Layer 1: localStorage — per-device, instant, supports similarity matching.
 * Layer 2: Firestore — cross-user, shared cache for exact normalized matches.
 *
 * - Similarity matching: if a new query is close enough to a cached one, serve the cached path.
 * - User history: last 10 paths for "My Learning Paths" review.
 * - TTL: localStorage 90 days, Firestore 7 days.
 */

import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseApp } from "./firebaseConfig";
import { devLog, devWarn } from "../utils/logger";

const CACHE_KEY = "bespoke_path_cache";
const HISTORY_KEY = "bespoke_path_history";
const MAX_CACHE = 50;
const MAX_HISTORY = 10;
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days (localStorage)
const FIRESTORE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (Firestore)
const FIRESTORE_COLLECTION = "pathCache";

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
 * Check if cache bypass is active (add ?nocache to URL for dev testing).
 */
function isCacheBypassed() {
  try {
    return new URLSearchParams(window.location.search).has("nocache");
  } catch {
    return false;
  }
}

/**
 * Look up a cached path by query similarity.
 * Layer 1: localStorage (fast, supports fuzzy matching)
 * Layer 2: Firestore (cross-user, exact match only)
 * Returns the cached result if found, or null.
 *
 * Add ?nocache to URL to bypass all caching for dev testing.
 */
export async function findCachedPath(query, threshold = 0.75) {
  if (isCacheBypassed()) {
    devLog("[PathCache] Cache bypassed (?nocache)");
    return null;
  }

  // Layer 1: localStorage (sync, fast)
  const localResult = findLocalCachedPath(query, threshold);
  if (localResult) {
    devLog(`[PathCache] localStorage hit for: "${query.substring(0, 40)}..."`);
    return localResult;
  }

  // Layer 2: Firestore (async, cross-user)
  try {
    const firestoreResult = await findFirestoreCachedPath(query);
    if (firestoreResult) {
      devLog(`[PathCache] Firestore hit for: "${query.substring(0, 40)}..."`);
      // Backfill localStorage for future instant hits
      cachePathLocal(query, firestoreResult);
      return firestoreResult;
    }
  } catch (err) {
    devWarn("[PathCache] Firestore lookup failed:", err.message);
  }

  return null;
}

/**
 * localStorage-only lookup (sync, similarity matching).
 */
function findLocalCachedPath(query, threshold = 0.75) {
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
 * Store a generated path in both localStorage and Firestore.
 */
export async function cachePath(query, result) {
  // Layer 1: localStorage (sync)
  cachePathLocal(query, result);

  // Layer 2: Firestore (async, fire-and-forget)
  cachePathFirestore(query, result).catch((err) =>
    devWarn("[PathCache] Firestore write failed:", err.message)
  );
}

/**
 * localStorage-only cache write.
 */
function cachePathLocal(query, result) {
  const cache = loadCache();
  const norm = normalizeQuery(query);
  const existing = cache.findIndex((e) => normalizeQuery(e.query) === norm);
  if (existing !== -1) {
    cache[existing] = { query, result, cachedAt: Date.now() };
  } else {
    cache.push({ query, result, cachedAt: Date.now() });
  }
  saveCache(cache);
}

// ── Firestore Cache Layer ──────────────────────────────

/**
 * Generate a deterministic cache key from a query + optional level.
 * Uses normalized query text to maximize cross-user hits.
 */
function generateCacheKey(query, level = "") {
  const norm = normalizeQuery(query) + (level ? `_${level}` : "");
  // Simple hash — deterministic and fast (no crypto needed for cache keys)
  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    const chr = norm.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32-bit integer
  }
  return `pc_${Math.abs(hash).toString(36)}`;
}

/**
 * Check Firestore for a cached path (exact normalized match).
 */
async function findFirestoreCachedPath(query) {
  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);
    const cacheKey = generateCacheKey(query);
    const docRef = doc(db, FIRESTORE_COLLECTION, cacheKey);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    // Check TTL
    const cachedAt = data.cachedAt?.toMillis?.() || data.cachedAtMs || 0;
    if (Date.now() - cachedAt > FIRESTORE_TTL_MS) {
      devLog("[PathCache] Firestore entry expired, skipping");
      return null;
    }

    // Reconstruct result from stored data
    return JSON.parse(data.resultJson);
  } catch {
    return null;
  }
}

/**
 * Write a generated path to Firestore for cross-user reuse.
 * Strips audio data and large embeddings to keep Firestore docs small.
 */
async function cachePathFirestore(query, result) {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  const cacheKey = generateCacheKey(query);
  const docRef = doc(db, FIRESTORE_COLLECTION, cacheKey);

  // Strip large fields that shouldn't be cached cross-user
  const stripped = {
    ...result,
    // Keep path steps but strip raw segment text to save space
    path: result.path?.map((step) => ({
      ...step,
      segment: step.segment
        ? {
            ...step.segment,
            text: (step.segment.text || "").substring(0, 500), // Truncate for space
          }
        : step.segment,
    })),
    // Remove embedding vectors (huge)
    segments: undefined,
  };

  await setDoc(docRef, {
    query: query,
    normalizedQuery: normalizeQuery(query),
    resultJson: JSON.stringify(stripped),
    cachedAt: serverTimestamp(),
    cachedAtMs: Date.now(),
    stepCount: result.path?.length || 0,
  });

  devLog(`[PathCache] Wrote to Firestore: ${cacheKey}`);
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
