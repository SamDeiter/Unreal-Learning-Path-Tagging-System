/**
 * Simple English stemmer — shared by videoRanking and docsSearchService.
 *
 * Strips common English suffixes for fuzzy matching.
 * e.g. "meshes" → "mesh", "importing" → "import", "textures" → "textur"
 */

// Bounded FIFO caches for stemming to avoid redundant string parsing and regex matches.
const WORD_CACHE = new Map();
const SENTENCE_CACHE = new Map();
const MAX_CACHE_SIZE = 5000;

/**
 * Helper to get or set cache value with a strict limit on size (FIFO eviction).
 */
function cacheGetOrSet(cache, key, calcFn) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  const val = calcFn(key);
  if (cache.size >= MAX_CACHE_SIZE) {
    // Fast FIFO deletion: removes the oldest key inserted.
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, val);
  return val;
}

/**
 * Stem a single word by stripping common English suffixes.
 * @param {string} word
 * @returns {string}
 */
export function stem(word) {
  if (!word) return "";
  return cacheGetOrSet(WORD_CACHE, word, (w) => {
    return w
      .replace(/ies$/i, "y")
      .replace(/ves$/i, "f")
      .replace(/(s|es|ing|ed|tion|ment)$/i, "")
      .toLowerCase();
  });
}

// Alias for backward compatibility
export const stemWord = stem;

/**
 * Get the stemmed words array for a given string sentence/phrase.
 * Split on word-boundary spaces, underscores, and hyphens.
 * Filters words shorter than 3 characters.
 * Cached to prevent redundant regex splits and token mapping.
 * @param {string} str
 * @returns {string[]}
 */
export function getSentenceStems(str) {
  if (!str) return [];
  return cacheGetOrSet(SENTENCE_CACHE, str, (s) => {
    return s
      .split(/[\s_-]+/)
      .filter((w) => w.length > 2)
      .map(stem);
  });
}

/**
 * Check if any stemmed word in string `a` matches any stemmed word in string `b`.
 * Uses word-boundary splitting on spaces, underscores, and hyphens.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function stemMatch(a, b) {
  const aStems = getSentenceStems(a);
  const bStems = getSentenceStems(b);
  return aStems.some(as => bStems.some(bs => as === bs || as.includes(bs) || bs.includes(as)));
}
