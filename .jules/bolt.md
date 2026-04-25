# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2025-05-15 - Graph Expansion Bottleneck in Batch Matching
**Learning:** In batch operations like course matching, performing graph traversal (BFS) for every target tag on every course is O(N*M*G) where G is the graph operation cost. Caching the expansion of a tag independently of the course reduces it to O(M*G + N*M).
**Action:** Always cache graph expansion results (like BFS frontiers) in a separate Map when the graph is static, and use identity-based caches (WeakMap) for per-object metadata.
