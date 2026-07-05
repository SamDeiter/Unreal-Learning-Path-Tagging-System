/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Compute Jaccard similarity between two texts based on word sets.
 * Filters words <= 2 chars to ignore noise.
 *
 * Supports both strings and pre-calculated Sets.
 *
 * @param {string|Set} a
 * @param {string|Set} b
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccard(a, b) {
  const wordsA = a instanceof Set ? a : new Set(
    (a || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
  const wordsB = b instanceof Set ? b : new Set(
    (b || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );

  if (wordsA.size === 0 && wordsB.size === 0) return 0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

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

  // Jaccard = |A ∩ B| / |A ∪ B|
  // |A ∪ B| = |A| + |B| - |A ∩ B| (Inclusion-Exclusion Principle)
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
