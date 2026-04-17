# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2025-05-15 - Redundant Tokenization in Semantic Deduplication
**Learning:** The semantic deduplication step in the RAG pipeline (`searchPipeline.js`) was an $O(N^2)$ bottleneck because it performed string tokenization on every comparison. Creating a new Set for every pair is extremely expensive in aggregate.
**Action:** Pre-tokenize candidates into Sets once before entering the comparison loop. Use the inclusion-exclusion principle ($|A \cup B| = |A| + |B| - |A \cap B|$) to calculate the Jaccard union in $O(1)$ instead of $O(N)$ by avoiding Set construction.
