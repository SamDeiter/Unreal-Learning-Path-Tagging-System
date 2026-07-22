/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenize a string into a Set of unique lowercased words with length > 2.
 * Uses a regex match to avoid split overhead and empty elements.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function getWordSet(text) {
  if (!text) return new Set();
  const words = text.toLowerCase().match(/\S+/g);
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
 * Compute Jaccard similarity between two pre-calculated word Sets.
 * Implements the Inclusion-Exclusion Principle (|A ∪ B| = |A| + |B| - |A ∩ B|)
 * to avoid Set allocation or array conversion overhead for the union.
 *
 * @param {Set<string>} wordsA
 * @param {Set<string>} wordsB
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccardFromSets(wordsA, wordsB) {
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

  const unionSize = wordsA.size + wordsB.size - intersection;
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
