/**
 * recentQueriesStore — localStorage-backed recent query storage
 * Privacy: data never leaves the browser.
 */

const RECENT_QUERIES_KEY = "ue5_recent_queries";
const MAX_RECENT = 10;

/**
 * Load recent queries from localStorage.
 * @returns {string[]}
 */
export function loadRecentQueries() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_QUERIES_KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * Save a query to localStorage (deduped, capped at MAX_RECENT).
 * @param {string} q
 */
export function saveRecentQuery(q) {
  const trimmed = q.trim();
  if (!trimmed) return;
  const current = loadRecentQueries().filter((x) => x !== trimmed);
  current.unshift(trimmed);
  localStorage.setItem(RECENT_QUERIES_KEY, JSON.stringify(current.slice(0, MAX_RECENT)));
}

/**
 * Remove a query from localStorage.
 * @param {string} q
 */
export function removeRecentQuery(q) {
  const trimmed = q.trim();
  if (!trimmed) return;
  const current = loadRecentQueries().filter((x) => x !== trimmed);
  localStorage.setItem(RECENT_QUERIES_KEY, JSON.stringify(current));
}

/**
 * Clear all recent queries from localStorage.
 */
export function clearRecentQueries() {
  localStorage.removeItem(RECENT_QUERIES_KEY);
}

export { RECENT_QUERIES_KEY, MAX_RECENT };
