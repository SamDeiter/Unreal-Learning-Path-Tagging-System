/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenize text into a Set of lowercase words of length > 2.
 * Uses linear matching of non-whitespace sequences which avoids large array allocation.
 *
 * @param {string} text
 * @returns {Set<string>} Set of lowercase words
 */
export function getWordSet(text) {
  const words = new Set();
  const rawText = (text || "").toLowerCase();
  const matches = rawText.match(/\S+/g);
  if (matches) {
    for (let i = 0; i < matches.length; i++) {
      const w = matches[i];
      if (w.length > 2) {
        words.add(w);
      }
    }
  }
  return words;
}

/**
 * Compute Jaccard similarity between two pre-calculated word sets.
 * Uses the Inclusion-Exclusion Principle to calculate the union without allocating a new Set:
 * |A ∪ B| = |A| + |B| - |A ∩ B|
 *
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccardFromSets(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  // Iterate over the smaller set for maximum performance
  if (setA.size < setB.size) {
    for (const w of setA) {
      if (setB.has(w)) intersection++;
    }
  } else {
    for (const w of setB) {
      if (setA.has(w)) intersection++;
    }
  }

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
