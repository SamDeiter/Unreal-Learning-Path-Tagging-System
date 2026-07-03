## 2025-05-15 - Redundant tokenization in O(N^2) loops
**Learning:** In RAG pipelines, semantic deduplication often involves Jaccard similarity. Performing tokenization and set creation inside the `some()` or `filter()` call during a nested loop leads to O(N^2 * M) complexity where M is the text length. Pre-calculating word sets before the loop reduces this to O(N * M + N^2).
**Action:** Always hoist tokenization out of deduplication or ranking loops. Use an optimized Jaccard implementation that operates on pre-existing sets and iterates over the smaller set.
