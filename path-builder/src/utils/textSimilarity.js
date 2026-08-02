/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Get a set of words from a string, filtered by word length (> 2).
 *
 * @param {string} text
 * @returns {Set<string>} Set of lowercase words
 */
export function getWordSet(text) {
  const words = (text || "").toLowerCase().match(/\S+/g);
  if (!words) return new Set();

  const set = new Set();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length > 2) {
      set.add(w);
    }
  }
  return set;
}

/**
 * Compute Jaccard similarity between two pre-calculated word sets.
 * Uses the Inclusion-Exclusion Principle to avoid extra Set/Array allocation.
 *
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  // Iterate over the smaller set to minimize lookups
  if (setA.size < setB.size) {
    for (const w of setA) {
      if (setB.has(w)) intersection++;
    }
  } else {
    for (const w of setB) {
      if (setA.has(w)) intersection++;
    }
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
  const setA = getWordSet(textA);
  const setB = getWordSet(textB);
  return wordJaccardFromSets(setA, setB);
}
