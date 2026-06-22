/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Compute Jaccard similarity between two texts based on word sets.
 * Filters words <= 2 chars to ignore noise.
 *
 * @param {string} textA
 * @param {string} textB
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccard(textA, textB) {
  const wordsA = new Set(
    (textA || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
  const wordsB = new Set(
    (textB || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );

  const sizeA = wordsA.size;
  const sizeB = wordsB.size;

  if (sizeA === 0 && sizeB === 0) return 0;

  let intersection = 0;
  // Optimization: Iterate over the smaller set to minimize lookups
  const [smaller, larger] = sizeA < sizeB ? [wordsA, wordsB] : [wordsB, wordsA];
  for (const w of smaller) {
    if (larger.has(w)) intersection++;
  }

  // Optimization: Use inclusion-exclusion principle (|A ∪ B| = |A| + |B| - |A ∩ B|)
  // to avoid allocating a new Set for the union.
  const union = sizeA + sizeB - intersection;
  return union === 0 ? 0 : intersection / union;
}
