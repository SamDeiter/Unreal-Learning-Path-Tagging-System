/**
 * Simple English stemmer — shared by videoRanking and docsSearchService.
 *
 * Strips common English suffixes for fuzzy matching.
 * e.g. "meshes" → "mesh", "importing" → "import", "textures" → "textur"
 */

// Caches with a basic size limit to prevent memory leaks in long-running processes
const MAX_CACHE_SIZE = 5000;
const stemCache = new Map();
const stemsCache = new Map();

/**
 * Stem a single word by stripping common English suffixes.
 * Cached to prevent redundant regex evaluation and lowercase transformations.
 * @param {string} word
 * @returns {string}
 */
export function stem(word) {
  const lower = word.toLowerCase();
  let cached = stemCache.get(lower);
  if (cached !== undefined) return cached;

  const result = lower
    .replace(/ies$/i, "y")
    .replace(/ves$/i, "f")
    .replace(/(s|es|ing|ed|tion|ment)$/i, "");

  if (stemCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = stemCache.keys().next().value;
    stemCache.delete(oldestKey);
  }
  stemCache.set(lower, result);
  return result;
}

// Alias for backward compatibility
export const stemWord = stem;

/**
 * Helper to split and stem words in a string, with caching.
 * @param {string} str
 * @returns {string[]}
 */
function getStems(str) {
  let cached = stemsCache.get(str);
  if (cached !== undefined) return cached;

  const stems = str.split(/[\s_-]+/).filter(w => w.length > 2).map(stem);

  if (stemsCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = stemsCache.keys().next().value;
    stemsCache.delete(oldestKey);
  }
  stemsCache.set(str, stems);
  return stems;
}

/**
 * Check if any stemmed word in string `a` matches any stemmed word in string `b`.
 * Uses word-boundary splitting on spaces, underscores, and hyphens.
 * Uses cached string stems to prevent redundant string tokenization and regex evaluation.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function stemMatch(a, b) {
  const aStems = getStems(a);
  const bStems = getStems(b);
  return aStems.some(as => bStems.some(bs => as === bs || as.includes(bs) || bs.includes(as)));
}
