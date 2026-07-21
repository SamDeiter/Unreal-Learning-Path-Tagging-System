/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Helper to tokenize a string into a Set of unique words with length > 2.
 * Uses a fast regex match to avoid split regex overhead.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function getWordSet(text) {
  const set = new Set();
  if (!text) return set;

  const words = text.toLowerCase().match(/\S+/g);
  if (words) {
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.length > 2) {
        set.add(w);
      }
    }
  }
  return set;
}

/**
 * Compute Jaccard similarity between two pre-calculated word sets.
 * Employs the Inclusion-Exclusion Principle (|A ∪ B| = |A| + |B| - |A ∩ B|)
 * to compute the union size without allocating any new Set objects.
 *
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  // Iterate over the smaller set for slightly faster execution
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
