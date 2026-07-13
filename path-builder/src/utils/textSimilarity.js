/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenize text into a Set of words > 2 chars.
 * @param {string} text
 * @returns {Set<string>}
 */
export function getWordSet(text) {
  if (!text) return new Set();
  return new Set(
    text.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
}

/**
 * Compute Jaccard similarity between two pre-calculated word sets.
 * Uses inclusion-exclusion principle: |A ∩ B| / |A ∪ B|
 * Where |A ∪ B| = |A| + |B| - |A ∩ B|
 *
 * @param {Set<string>} wordsA
 * @param {Set<string>} wordsB
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(wordsA, wordsB) {
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  // Smaller set as the outer loop for minor optimization
  const [small, large] = wordsA.size <= wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA];

  let intersection = 0;
  for (const w of small) {
    if (large.has(w)) intersection++;
  }

  if (intersection === 0) return 0;

  const unionSize = wordsA.size + wordsB.size - intersection;
  return intersection / unionSize;
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
