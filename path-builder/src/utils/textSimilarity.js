/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenize text into a Set of words.
 * Filters words <= 2 chars to ignore noise.
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
 * Compute Jaccard similarity between two texts or pre-computed word sets.
 *
 * @param {string|Set<string>} a - First text or word set
 * @param {string|Set<string>} b - Second text or word set
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccard(a, b) {
  const wordsA = a instanceof Set ? a : getWordSet(a);
  const wordsB = b instanceof Set ? b : getWordSet(b);

  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  // Iterate over the smaller set for efficiency
  if (wordsA.size < wordsB.size) {
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
  } else {
    for (const w of wordsB) {
      if (wordsA.has(w)) intersection++;
    }
  }

  // Use inclusion-exclusion principle: |A ∪ B| = |A| + |B| - |A ∩ B|
  const unionSize = wordsA.size + wordsB.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}
