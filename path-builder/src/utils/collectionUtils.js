/**
 * collectionUtils — Shared array deduplication and merging utilities.
 *
 * Replaces the repeated `new Set()` + `.filter()` pattern found in
 * searchPipeline, segmentSearchService, courseMatching, challengeService,
 * TagGraphService, and narratorService.
 */

/**
 * Deduplicate an array by a key derived from each item.
 * Keeps the first occurrence of each unique key.
 *
 * @param {Array} arr - Array to deduplicate
 * @param {Function} keyFn - Function that returns a string key for each item
 * @returns {Array} Deduplicated array (preserves original order)
 *
 * @example
 *   deduplicateBy(passages, p => p.text.trim().toLowerCase().slice(0, 120));
 *   deduplicateBy(courses, c => c.code);
 */
export function deduplicateBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Merge multiple arrays and deduplicate by key.
 * Items from earlier arrays take priority.
 *
 * @param {Array[]} arrays - Arrays to merge
 * @param {Function} keyFn - Key function for dedup
 * @returns {Array} Merged and deduplicated array
 *
 * @example
 *   mergeUnique([transcriptResults, tagResults], r => r.code);
 */
export function mergeUnique(arrays, keyFn) {
  return deduplicateBy(arrays.flat(), keyFn);
}
