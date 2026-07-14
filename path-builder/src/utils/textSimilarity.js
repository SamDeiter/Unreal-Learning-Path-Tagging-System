/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenize text into a Set of words, filtering short words.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function getWordSet(text) {
  return new Set((text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2));
}

/**
 * Compute Jaccard similarity between two pre-calculated word sets.
 * Uses the inclusion-exclusion principle for efficient union calculation.
 *
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  // Iterate over the smaller set for slight optimization
  const [smaller, larger] = setA.size < setB.size ? [setA, setB] : [setB, setA];

  for (const w of smaller) {
    if (larger.has(w)) intersection++;
  }

  // Inclusion-Exclusion Principle: |A ∪ B| = |A| + |B| - |A ∩ B|
  const unionSize = setA.size + setB.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}

/**
 * Compute Jaccard similarity between two texts based on word sets.
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
