/**
 * Simple English stemmer — shared by videoRanking and docsSearchService.
 *
 * Strips common English suffixes for fuzzy matching.
 * e.g. "meshes" → "mesh", "importing" → "import", "textures" → "textur"
 */

const stemCache = new Map();
const stringStemsCache = new Map();
const MAX_CACHE_SIZE = 5000;

/**
 * Stem a single word by stripping common English suffixes.
 * @param {string} word
 * @returns {string}
 */
export function stem(word) {
  if (!word) return "";
  const clean = word.toLowerCase();

  if (stemCache.has(clean)) {
    return stemCache.get(clean);
  }

  const result = clean
    .replace(/ies$/i, "y")
    .replace(/ves$/i, "f")
    .replace(/(s|es|ing|ed|tion|ment)$/i, "");

  if (stemCache.size >= MAX_CACHE_SIZE) {
    // FIFO eviction
    stemCache.delete(stemCache.keys().next().value);
  }
  stemCache.set(clean, result);
  return result;
}

// Alias for backward compatibility
export const stemWord = stem;

/**
 * Get stemmed words for a full string with caching.
 * @param {string} str
 * @returns {string[]}
 */
export function getStemsForString(str) {
  if (!str) return [];
  if (stringStemsCache.has(str)) {
    return stringStemsCache.get(str);
  }

  const result = str
    .split(/[\s_-]+/)
    .filter((w) => w.length > 2)
    .map(stem);

  if (stringStemsCache.size >= MAX_CACHE_SIZE) {
    // FIFO eviction
    stringStemsCache.delete(stringStemsCache.keys().next().value);
  }
  stringStemsCache.set(str, result);
  return result;
}

/**
 * Check if any stemmed word in string `a` matches any stemmed word in string `b`.
 * Uses word-boundary splitting on spaces, underscores, and hyphens.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function stemMatch(a, b) {
  const aStems = getStemsForString(a);
  const bStems = getStemsForString(b);
  return aStems.some(as => bStems.some(bs => as === bs || as.includes(bs) || bs.includes(as)));
}
