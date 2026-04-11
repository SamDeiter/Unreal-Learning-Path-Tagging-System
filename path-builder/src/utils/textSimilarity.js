/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenizes a string into a Set of words.
 * Filters words <= 2 chars to ignore noise.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function tokenizeToSet(text) {
  return new Set(
    (text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
}

/**
 * Compute Jaccard similarity between two texts based on word sets.
 * Filters words <= 2 chars to ignore noise.
 *
 * @param {string|Set<string>} a - Text or pre-computed Set of words
 * @param {string|Set<string>} b - Text or pre-computed Set of words
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccard(a, b) {
  const wordsA = a instanceof Set ? a : tokenizeToSet(a);
  const wordsB = b instanceof Set ? b : tokenizeToSet(b);

  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  // Jaccard = |A ∩ B| / |A ∪ B|
  // Inclusion-Exclusion: |A ∪ B| = |A| + |B| - |A ∩ B|
  const unionSize = wordsA.size + wordsB.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}
