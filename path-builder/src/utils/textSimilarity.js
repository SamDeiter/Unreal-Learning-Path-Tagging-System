/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenizes text and returns a Set of words with length > 2.
 * Uses a clean regex match to avoid empty string array allocations from split.
 *
 * @param {string} text
 * @returns {Set<string>} Set of lowercase words
 */
export function getWordSet(text) {
  const normalized = (text || "").toLowerCase();
  const tokens = normalized.match(/\S+/g);
  if (!tokens) return new Set();

  const words = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (w.length > 2) {
      words.add(w);
    }
  }
  return words;
}

/**
 * Computes Jaccard similarity between two pre-calculated word sets.
 * Employs the Inclusion-Exclusion Principle (|A ∪ B| = |A| + |B| - |A ∩ B|)
 * to completely eliminate allocating a new union Set.
 *
 * @param {Set<string>} wordsA
 * @param {Set<string>} wordsB
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(wordsA, wordsB) {
  if (wordsA.size === 0 && wordsB.size === 0) return 0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  // Track intersection size
  let intersection = 0;
  // Always loop through the smaller set to minimize lookup operations
  const smaller = wordsA.size < wordsB.size ? wordsA : wordsB;
  const larger = smaller === wordsA ? wordsB : wordsA;

  for (const w of smaller) {
    if (larger.has(w)) {
      intersection++;
    }
  }

  // Use Inclusion-Exclusion Principle to calculate union size
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
  const setA = getWordSet(textA);
  const setB = getWordSet(textB);
  return wordJaccardFromSets(setA, setB);
}
