/**
 * Simple English stemmer — shared by videoRanking and docsSearchService.
 *
 * Strips common English suffixes for fuzzy matching.
 * e.g. "meshes" → "mesh", "importing" → "import", "textures" → "textur"
 */

// Performance optimization: cache results of expensive stem operation
const stemCache = new Map();

/**
 * Stem a single word by stripping common English suffixes.
 * @param {string} word
 * @returns {string}
 */
export function stem(word) {
  if (!word) return "";
  const cached = stemCache.get(word);
  if (cached !== undefined) return cached;

  const stemmed = word
    .replace(/ies$/i, "y")
    .replace(/ves$/i, "f")
    .replace(/(s|es|ing|ed|tion|ment)$/i, "")
    .toLowerCase();

  stemCache.set(word, stemmed);
  return stemmed;
}

// Alias for backward compatibility
export const stemWord = stem;

// Performance optimization: cache array of stemmed tokens for entire strings
const stringStemsCache = new Map();

/**
 * Retrieve the stemmed tokens for a given string, utilizing memory cache.
 * @param {string} str
 * @returns {string[]}
 */
function getStems(str) {
  if (!str) return [];
  const cached = stringStemsCache.get(str);
  if (cached !== undefined) return cached;

  const stems = str
    .split(/[\s_-]+/)
    .filter((w) => w.length > 2)
    .map(stem);

  stringStemsCache.set(str, stems);
  return stems;
}

/**
 * Check if any stemmed word in string `a` matches any stemmed word in string `b`.
 * Uses word-boundary splitting on spaces, underscores, and hyphens.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function stemMatch(a, b) {
  const aStems = getStems(a);
  const bStems = getStems(b);

  // High performance iteration without nested lambda allocation
  for (let i = 0; i < aStems.length; i++) {
    const as = aStems[i];
    for (let j = 0; j < bStems.length; j++) {
      const bs = bStems[j];
      if (as === bs || as.includes(bs) || bs.includes(as)) {
        return true;
      }
    }
  }
  return false;
}
