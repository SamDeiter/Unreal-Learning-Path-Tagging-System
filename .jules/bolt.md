# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2026-04-29 - Graph Traversal Bottleneck in Course Scoring
**Learning:** Performing Breadth-First Search (BFS) expansions of query tags inside the per-course scoring loop creates an O(Q * C * G) complexity where Q is query tags, C is courses, and G is graph size. Caching these expansions per unique tag reduces it to O(Q * G + Q * C), yielding a ~6x speedup.
**Action:** Always pre-calculate and cache static graph reachable sets before entering high-frequency loops like batch ranking.
