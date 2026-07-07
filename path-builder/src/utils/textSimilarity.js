/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenize text into a Set of words > 2 chars.
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
 * Uses inclusion-exclusion principle: union = sizeA + sizeB - intersection.
 *
 * @param {Set<string>} wordsA
 * @param {Set<string>} wordsB
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(wordsA, wordsB) {
  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  // Iterate over smaller set to minimize lookups
  if (wordsA.size > wordsB.size) {
    for (const w of wordsB) {
      if (wordsA.has(w)) intersection++;
    }
  } else {
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
  }

  const union = wordsA.size + wordsB.size - intersection;
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
  return wordJaccardFromSets(getWordSet(textA), getWordSet(textB));
}
