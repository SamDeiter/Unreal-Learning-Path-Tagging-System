/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Extract a Set of lowercase words longer than 2 characters from a text string.
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
 * Uses the Inclusion-Exclusion Principle to avoid new Set allocations.
 *
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;

  // Iterate over the smaller set for faster intersection check
  const [small, large] = setA.size < setB.size ? [setA, setB] : [setB, setA];

  let intersection = 0;
  for (const w of small) {
    if (large.has(w)) intersection++;
  }

  // |A ∪ B| = |A| + |B| - |A ∩ B|
  const unionSize = setA.size + setB.size - intersection;
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
