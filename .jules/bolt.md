## 2025-06-03 - [Hot Path Optimization: TagGraph Relevance Scoring]
**Learning:** `TagGraphService.scoreCourseRelevance` was performing redundant BFS graph traversals and course tag normalization for every course in the library (2400+ courses), leading to a significant bottleneck in search/matching.
**Action:** Implement identity-based caching (WeakMap) for normalized course metadata and result-based caching (Map) for BFS expansion results. This reduced scoring time by ~80% (0.19ms -> 0.037ms per course).
