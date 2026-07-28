/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Extract a Set of lowercase words from text, ignoring words of length <= 2.
 * Highly optimized to minimize allocations and regex overhead.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function getWordSet(text) {
  if (!text) return new Set();
  const tokens = text.toLowerCase().match(/\S+/g) || [];
  const set = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.length > 2) {
      set.add(token);
    }
  }
  return set;
}

/**
 * Compute Jaccard similarity between two pre-calculated word Sets.
 * Implements the Inclusion-Exclusion Principle to avoid union set allocation.
 *
 * @param {Set<string>} wordsA
 * @param {Set<string>} wordsB
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(wordsA, wordsB) {
  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  const [smaller, larger] = wordsA.size < wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA];

  for (const w of smaller) {
    if (larger.has(w)) intersection++;
  }

  const unionSize = wordsA.size + wordsB.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}

/**
 * Compute Jaccard similarity between two texts based on word sets.
 * Filters words <= 2 chars to ignore noise.
 *
 * @param {string} textA
 * @param {string} textB
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccard(textA, textB) {
  return wordJaccardFromSets(getWordSet(textA), getWordSet(textB));
}
