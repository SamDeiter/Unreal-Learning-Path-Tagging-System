/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Parses text into a unique Set of lowercased words longer than 2 characters.
 * Extracting this allows caching word sets to avoid redundant tokenization.
 *
 * @param {string} text
 * @returns {Set<string>}
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
 * Computes Jaccard similarity between two pre-calculated word Sets.
 * Uses the Inclusion-Exclusion Principle to calculate the union size without Set allocation
 * and iterates through the smaller set to minimize lookup operations.
 *
 * @param {Set<string>} wordsA
 * @param {Set<string>} wordsB
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(wordsA, wordsB) {
  if (wordsA.size === 0 && wordsB.size === 0) return 0;

  let intersection = 0;
  // Optimize: iterate through the smaller set to find intersection faster
  const [smaller, larger] = wordsA.size < wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA];
  for (const w of smaller) {
    if (larger.has(w)) {
      intersection++;
    }
  }

  // Inclusion-Exclusion Principle: |A ∪ B| = |A| + |B| - |A ∩ B|
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
  const wordsA = getWordSet(textA);
  const wordsB = getWordSet(textB);
  return wordJaccardFromSets(wordsA, wordsB);
}
