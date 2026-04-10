# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2025-05-15 - Redundant Tokenization in Semantic Deduplication
**Learning:** The semantic deduplication loop in the RAG pipeline was bottlenecked by O(N^2) calls to wordJaccard, each performing expensive regex-based tokenization. Pre-computing Set objects reduced comparison time from 65ms to 3ms for 10k operations (~22x speedup).
**Action:** Always pre-tokenize strings into Sets when performing multiple pairwise comparisons (Jaccard, overlap, etc.) and use the inclusion-exclusion principle to calculate union size without Set instantiation.
