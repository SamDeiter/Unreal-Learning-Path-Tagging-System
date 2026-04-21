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
export function tokenize(text) {
  return new Set(
    (text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
}

/**
 * Compute Jaccard similarity between two texts based on word sets.
 *
 * @param {string|Set<string>} textA
 * @param {string|Set<string>} textB
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccard(textA, textB) {
  const wordsA = textA instanceof Set ? textA : tokenize(textA);
  const wordsB = textB instanceof Set ? textB : tokenize(textB);

  if (wordsA.size === 0 && wordsB.size === 0) return 0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  // Optimized intersection: iterate over the smaller set
  let intersection = 0;
  const smaller = wordsA.size < wordsB.size ? wordsA : wordsB;
  const larger = wordsA.size < wordsB.size ? wordsB : wordsA;

  for (const w of smaller) {
    if (larger.has(w)) intersection++;
  }

  // Optimized union: |A ∪ B| = |A| + |B| - |A ∩ B|
  const unionSize = wordsA.size + wordsB.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}
