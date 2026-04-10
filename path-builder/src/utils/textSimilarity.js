/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenizes text into a Set of words > 2 characters.
 * @param {string} text
 * @returns {Set<string>}
 */
export function getWordSet(text) {
  if (!text || typeof text !== "string") return new Set();
  return new Set(
    text.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
}

/**
 * Compute Jaccard similarity between two texts based on word sets.
 * Filters words <= 2 chars to ignore noise.
 *
 * @param {string|Set} textA - Text string or pre-computed Set from getWordSet
 * @param {string|Set} textB - Text string or pre-computed Set from getWordSet
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccard(textA, textB) {
  const setA = textA instanceof Set ? textA : getWordSet(textA);
  const setB = textB instanceof Set ? textB : getWordSet(textB);

  if (setA.size === 0 && setB.size === 0) return 0;
  if (setA.size === 0 || setB.size === 0) return 0;

  // Optimization: Always iterate over the smaller set for intersection
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];

  let intersection = 0;
  for (const w of smaller) {
    if (larger.has(w)) intersection++;
  }

  // Inclusion-Exclusion Principle: |A ∪ B| = |A| + |B| - |A ∩ B|
  // Avoids creating a new Set and an intermediate array spread
  const unionSize = setA.size + setB.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}
