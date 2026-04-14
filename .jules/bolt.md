# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2025-05-15 - Redundant Tokenization in Semantic Deduplication
**Learning:** The semantic deduplication step in `searchPipeline.js` uses an $O(N^2)$ loop. Calling `wordJaccard` with raw strings inside this loop causes redundant tokenization (splitting, filtering, Set creation) for every comparison. Additionally, the standard Jaccard implementation using `new Set([...A, ...B])` is inefficient in both time and space.
**Action:** Pre-tokenize strings into `Sets` before the $O(N^2)$ loop to reduce tokenization to $O(N)$. Optimize `wordJaccard` to use the inclusion-exclusion principle $|A \cup B| = |A| + |B| - |A \cap B|$ and iterate over the smaller set for intersection.
