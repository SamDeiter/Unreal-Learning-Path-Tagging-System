/**
 * textSimilarity.js — Word-level Jaccard similarity for semantic deduplication.
 */

/**
 * Tokenize text into a Set of unique words.
 * Filters words <= 2 chars to ignore noise and normalizes to lowercase.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function tokenize(text) {
  return new Set(
    (text || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
}

/**
 * Compute Jaccard similarity between two texts or pre-tokenized Sets.
 * Filters words <= 2 chars to ignore noise.
 *
 * @param {string|Set<string>} a
 * @param {string|Set<string>} b
 * @returns {number} Similarity in [0, 1] — 1 means identical word sets
 */
export function wordJaccard(a, b) {
  const setA = a instanceof Set ? a : tokenize(a);
  const setB = b instanceof Set ? b : tokenize(b);

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

  // Jaccard Index = |A ∩ B| / |A ∪ B|
  // Using inclusion-exclusion: |A ∪ B| = |A| + |B| - |A ∩ B|
  const unionSize = setA.size + setB.size - intersection;
  return unionSize === 0 ? 0 : intersection / unionSize;
}
