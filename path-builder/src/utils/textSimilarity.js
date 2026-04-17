/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenize text into a set of words for matching.
 * Filters words <= 2 chars to ignore noise.
 *
 * @param {string|Set} text
 * @returns {Set}
 */
export function tokenize(text) {
  if (text instanceof Set) return text;
  return new Set((text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2));
}

/**
 * Compute Jaccard similarity between two texts based on word sets.
 *
 * @param {string|Set} textA
 * @param {string|Set} textB
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccard(textA, textB) {
  const wordsA = tokenize(textA);
  const wordsB = tokenize(textB);

  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  // Use inclusion-exclusion principle: |A ∪ B| = |A| + |B| - |A ∩ B|
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
