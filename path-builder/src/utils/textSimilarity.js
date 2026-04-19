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
export function tokenize(text) {
  return new Set(
    (text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
}

/**
 * Compute Jaccard similarity between two texts or pre-computed word sets.
 *
 * @param {string|Set<string>} a
 * @param {string|Set<string>} b
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccard(a, b) {
  const wordsA = a instanceof Set ? a : tokenize(a);
  const wordsB = b instanceof Set ? b : tokenize(b);

  const sizeA = wordsA.size;
  const sizeB = wordsB.size;

  if (sizeA === 0 && sizeB === 0) return 0;

  let intersection = 0;
  // Iterate over the smaller set to find intersection faster
  if (sizeA < sizeB) {
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
  } else {
    for (const w of wordsB) {
      if (wordsA.has(w)) intersection++;
    }
  }

  // Use inclusion-exclusion principle: |A ∪ B| = |A| + |B| - |A ∩ B|
  const union = sizeA + sizeB - intersection;
  return union === 0 ? 0 : intersection / union;
}
