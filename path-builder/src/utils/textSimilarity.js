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

  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}
