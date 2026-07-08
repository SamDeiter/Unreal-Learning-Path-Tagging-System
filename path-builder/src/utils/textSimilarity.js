/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenize text into a Set of words.
 * Filters words <= 2 chars to ignore noise.
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
 * Compute Jaccard similarity between two pre-tokenized word sets.
 * Uses inclusion-exclusion (sizeA + sizeB - intersection) for O(intersection) union calculation.
 *
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number} Similarity in [0, 1]
 */
export function wordJaccardFromSets(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  // Iterate over smaller set for efficiency
  const [small, large] = setA.size < setB.size ? [setA, setB] : [setB, setA];
  for (const w of small) {
    if (large.has(w)) intersection++;
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
  return wordJaccardFromSets(getWordSet(textA), getWordSet(textB));
}
