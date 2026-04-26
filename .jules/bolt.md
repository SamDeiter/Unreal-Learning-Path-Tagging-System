# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2025-05-15 - BFS Expansion Overhead in Graph Scoring
**Learning:** Performing a 2-hop BFS traversal of the tag graph for every course-tag pair during scoring created a significant (Courses \times Tags \times BFS)$ bottleneck.
**Action:** Implement a two-tier caching strategy: use a `Map` to cache BFS results per query tag, and a `WeakMap` to store pre-normalized metadata on course objects. This reduced scoring latency from ~0.11ms to ~0.04ms per course.
