# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2025-05-15 - O(N^2) Redundant Tokenization in Semantic Deduplication
**Learning:** Semantic deduplication in the search pipeline was performing O(N^2) comparisons where each comparison re-tokenized both strings. For 200 retrieved passages, this resulted in 40,000 tokenization operations.
**Action:** Pre-tokenize all items into `Set`s before entering nested loops. Optimize Jaccard similarity to use the inclusion-exclusion principle ($|A \cup B| = |A| + |B| - |A \cap B|$) to avoid expensive Union Set creation.
