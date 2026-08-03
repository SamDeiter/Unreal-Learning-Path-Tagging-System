/**
 * Simple English stemmer — shared by videoRanking and docsSearchService.
 *
 * Strips common English suffixes for fuzzy matching.
 * e.g. "meshes" → "mesh", "importing" → "import", "textures" → "textur"
 */

const stemCache = new Map();
const sentenceCache = new Map();
const MAX_CACHE_SIZE = 5000;

/**
 * Stem a single word by stripping common English suffixes.
 * Uses a bounded Map cache with FIFO eviction to eliminate redundant processing.
 * @param {string} word
 * @returns {string}
 */
export function stem(word) {
  if (typeof word !== "string") return "";
  const cached = stemCache.get(word);
  if (cached !== undefined) return cached;

  const result = word
    .replace(/ies$/i, "y")
    .replace(/ves$/i, "f")
    .replace(/(s|es|ing|ed|tion|ment)$/i, "")
    .toLowerCase();

  if (stemCache.size >= MAX_CACHE_SIZE) {
    const firstKey = stemCache.keys().next().value;
    stemCache.delete(firstKey);
  }
  stemCache.set(word, result);
  return result;
}

// Alias for backward compatibility
export const stemWord = stem;

/**
 * Helper to get pre-split and pre-stemmed words for a sentence/string.
 * Uses a bounded Map cache with FIFO eviction to optimize sentence tokenization.
 * @param {string} str
 * @returns {string[]}
 */
function getCachedStems(str) {
  if (typeof str !== "string") return [];
  const cached = sentenceCache.get(str);
  if (cached !== undefined) return cached;

  const result = str
    .split(/[\s_-]+/)
    .filter((w) => w.length > 2)
    .map(stem);

  if (sentenceCache.size >= MAX_CACHE_SIZE) {
    const firstKey = sentenceCache.keys().next().value;
    sentenceCache.delete(firstKey);
  }
  sentenceCache.set(str, result);
  return result;
}

/**
 * Check if any stemmed word in string `a` matches any stemmed word in string `b`.
 * Uses word-boundary splitting on spaces, underscores, and hyphens with caching.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function stemMatch(a, b) {
  const aStems = getCachedStems(a);
  const bStems = getCachedStems(b);
  return aStems.some((as) =>
    bStems.some((bs) => as === bs || as.includes(bs) || bs.includes(as))
  );
}
