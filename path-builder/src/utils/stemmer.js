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
 * Check if any stemmed word in string `a` matches any stemmed word in string `b`.
 * Uses word-boundary splitting on spaces, underscores, and hyphens.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function stemMatch(a, b) {
  const aStems = a.split(/[\s_-]+/).filter(w => w.length > 2).map(stem);
  const bStems = b.split(/[\s_-]+/).filter(w => w.length > 2).map(stem);
  return aStems.some(as => bStems.some(bs => as === bs || as.includes(bs) || bs.includes(as)));
}
