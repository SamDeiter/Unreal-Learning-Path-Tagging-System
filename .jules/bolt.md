# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2026-04-26 - Optimized Tag Graph Scoring with BFS Caching
**Learning:** The `TagGraphService.scoreCourseRelevance` method was a significant bottleneck because it performed a 2-hop BFS expansion of the tag graph for every course-tag pair during search/matching. For a search with 3 tags against 2,400 courses, this meant 7,200 BFS traversals.
**Action:** Extract the BFS to a cached `_performGraphExpansion` method and use a `WeakMap` to cache pre-normalized course tag sets and suffix maps. This reduced average scoring time per course from ~0.11ms to ~0.04ms (a ~2.7x speedup).
