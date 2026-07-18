/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Generate a Set of words from a string, filtering out words <= 2 characters.
 * Useful for pre-calculating word sets before iterative comparisons.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function getWordSet(text) {
  return new Set(
    (text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
}

/**
 * Compute Jaccard similarity between two pre-calculated word sets.
 * Uses the Inclusion-Exclusion Principle to calculate the union size without allocating a new Set.
 *
 * @param {Set<string>} wordsA
 * @param {Set<string>} wordsB
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccardFromSets(wordsA, wordsB) {
  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  // Performance optimization: iterate over the smaller set to find the intersection
  const [smaller, larger] = wordsA.size < wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA];
  for (const w of smaller) {
    if (larger.has(w)) intersection++;
  }

  // |A ∪ B| = |A| + |B| - |A ∩ B|
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
  const wordsA = getWordSet(textA);
  const wordsB = getWordSet(textB);
  return wordJaccardFromSets(wordsA, wordsB);
}
