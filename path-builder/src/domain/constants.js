/**
 * Shared constants for search and matching logic.
 * Single source of truth — imported by courseMatching.js and segmentSearchService.js.
 */

/**
 * Common transcript/title words that appear in nearly every course and add no signal.
 * Merged superset from courseMatching.js and segmentSearchService.js.
 */
export const SEARCH_STOPWORDS = new Set([
  // Core English stopwords
  "the", "and", "for", "with", "this", "that", "are", "was", "has", "have",
  "not", "can", "into", "from", "how", "you", "your", "will", "would",
  // Common filler words
  "also", "just", "like", "more", "very", "some", "want", "need",
  "make", "use", "used", "using", "help", "helpful", "helps",
  "get", "getting", "let", "look", "going", "come", "here", "there",
  "know", "thing", "really", "actually", "basically", "something", "everything",
  // Symptom-like generic verbs (add no signal to UE5 search)
  "slow", "fast", "leading", "exhibiting", "experiencing", "causing",
  // More common words
  "about", "been", "being", "could", "does", "doing", "done",
  "each", "even", "every", "first", "give", "good", "great", "kind",
  "made", "much", "over", "part", "right", "same", "see", "show",
  "start", "still", "take", "tell", "than", "them", "then", "these",
  "they", "those", "through", "time", "took", "turn", "way", "well",
  "what", "when", "where", "which", "while", "work", "working",
  // UE5-specific generic words (too broad to be useful alone)
  "unreal", "engine", "introduction", "quick",
]);
