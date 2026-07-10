/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Get a set of words from a string, filtering short words.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function getWordSet(text) {
  return new Set((text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2));
}

/**
 * Compute Jaccard similarity between two pre-calculated word sets.
 *
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccardFromSets(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }

  // Jaccard = |A ∩ B| / |A ∪ B|
  // |A ∪ B| = |A| + |B| - |A ∩ B|
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
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
