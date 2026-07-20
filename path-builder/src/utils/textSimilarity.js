/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Parse text into a Set of lowercased words with length > 2.
 * Optimizes memory by avoiding intermediate array allocations from filter().
 *
 * @param {string} text - Input text to parse
 * @returns {Set<string>} A Set of filtered lowercased words
 */
export function getWordSet(text) {
  if (!text) return new Set();
  const words = text.toLowerCase().split(/\s+/);
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
 * Employs the Inclusion-Exclusion Principle (|A ∪ B| = |A| + |B| - |A ∩ B|)
 * to compute union size with zero object allocations, bypassing Set & Array creation.
 *
 * @param {Set<string>} setA - Pre-calculated set of words for text A
 * @param {Set<string>} setB - Pre-calculated set of words for text B
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(setA, setB) {
  if (!setA || !setB) return 0;
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  // Performance optimization: iterate over the smaller set to minimize lookup overhead
  const [small, large] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  for (const w of small) {
    if (large.has(w)) {
      intersection++;
    }
  }

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
  const setA = getWordSet(textA);
  const setB = getWordSet(textB);
  return wordJaccardFromSets(setA, setB);
}
