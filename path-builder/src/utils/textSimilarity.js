/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenize text into a Set of words, filtering out short words (<= 2 chars).
 * Optimized to use regex matching on non-whitespace characters instead of splitting.
 *
 * @param {string} text
 * @returns {Set<string>} Set of unique words
 */
export function getWordSet(text) {
  if (!text) return new Set();
  const lower = text.toLowerCase();
  const words = lower.match(/\S+/g);
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
 * Employs the Inclusion-Exclusion Principle (|A ∪ B| = |A| + |B| - |A ∩ B|)
 * to avoid allocating a new Set for the union.
 *
 * @param {Set<string>} wordsA
 * @param {Set<string>} wordsB
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccardFromSets(wordsA, wordsB) {
  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  // Optimize iteration to loop over the smaller set
  let intersection = 0;
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
