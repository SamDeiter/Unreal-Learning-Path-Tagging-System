/**
 * Simple English stemmer — shared by videoRanking and docsSearchService.
 *
 * Strips common English suffixes for fuzzy matching.
 * e.g. "meshes" → "mesh", "importing" → "import", "textures" → "textur"
 */

/**
 * Stem a single word by stripping common English suffixes.
 * @param {string} word
 * @returns {string}
 */
export function stem(word) {
  return word
    .replace(/ies$/i, "y")
    .replace(/ves$/i, "f")
    .replace(/(s|es|ing|ed|tion|ment)$/i, "")
    .toLowerCase();
}

// Alias for backward compatibility
export const stemWord = stem;

/**
 * Tokenize and stem a given string, filtering out words <= 2 characters.
 * Splitting is done on spaces, underscores, and hyphens.
 *
 * @param {string} text
 * @returns {string[]} Array of stems
 */
export function getStems(text) {
  if (!text) return [];
  return text.split(/[\s_-]+/).filter((w) => w.length > 2).map(stem);
}

/**
 * Check if any stemmed word in pre-calculated stem array `aStems` matches any
 * stemmed word in pre-calculated stem array `bStems`.
 *
 * @param {string[]} aStems
 * @param {string[]} bStems
 * @returns {boolean}
 */
export function stemMatchStems(aStems, bStems) {
  if (!aStems || !bStems || aStems.length === 0 || bStems.length === 0) return false;
  return aStems.some((as) =>
    bStems.some((bs) => as === bs || as.includes(bs) || bs.includes(as))
  );
}

/**
 * Check if any stemmed word in string `a` matches any stemmed word in string `b`.
 * Uses word-boundary splitting on spaces, underscores, and hyphens.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function stemMatch(a, b) {
  return stemMatchStems(getStems(a), getStems(b));
}
