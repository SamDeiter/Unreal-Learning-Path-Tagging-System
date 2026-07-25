/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenize a text into a Set of lowercase words of length > 2.
 * Uses a regex match to avoid empty string allocation from split.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function getWordSet(text) {
  if (!text) return new Set();
  const normalized = text.toLowerCase();
  const matches = normalized.match(/\S+/g);
  if (!matches) return new Set();

  const set = new Set();
  for (let i = 0; i < matches.length; i++) {
    const word = matches[i];
    if (word.length > 2) {
      set.add(word);
    }
  }
  return set;
}

/**
 * Compute Jaccard similarity between two pre-calculated word sets.
 * Uses Inclusion-Exclusion Principle (|A ∪ B| = |A| + |B| - |A ∩ B|)
 * to compute union size, avoiding allocating a new Set object.
 *
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  // Iterate over the smaller set for efficiency
  if (setA.size < setB.size) {
    for (const w of setA) {
      if (setB.has(w)) intersection++;
    }
  } else {
    for (const w of setB) {
      if (setA.has(w)) intersection++;
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
