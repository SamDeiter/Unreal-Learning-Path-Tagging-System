/**
 * dataLoader.js — Centralized lazy loader for large static JSON data files.
 *
 * Instead of bundling 75 MB of JSON through Vite's build pipeline,
 * these files live in public/data/ and are fetched at runtime.
 * Each file is cached after first load.
 *
 * Usage:
 *   const data = await fetchJSON("transcript_segments");
 */

const BASE = import.meta.env.BASE_URL || "/";

/** In-memory cache keyed by filename (no extension). */
const cache = new Map();

/**
 * Fetch a JSON data file from public/data/{name}.json.
 * Returns cached result on subsequent calls.
 *
 * @param {string} name — File name without extension (e.g. "search_index")
 * @returns {Promise<any>} Parsed JSON data
 */
export async function fetchJSON(name) {
  if (cache.has(name)) return cache.get(name);

  const url = `${BASE}data/${name}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[dataLoader] ${url} returned ${res.status} — data unavailable`);
      return null;
    }
    const data = await res.json();
    cache.set(name, data);
    return data;
  } catch (err) {
    console.warn(`[dataLoader] Failed to load ${url}:`, err.message);
    return null;
  }
}

/**
 * Preload a data file without blocking. Useful for warming the cache
 * right before a feature is likely to need the data.
 *
 * @param {string} name — File name without extension
 */
export function preloadJSON(name) {
  if (!cache.has(name)) {
    fetchJSON(name).catch(() => {
      /* silent — will retry on actual use */
    });
  }
}

/** Clear cache (useful for testing). */
export function clearDataCache() {
  cache.clear();
}
