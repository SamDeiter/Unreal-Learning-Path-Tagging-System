## 2025-05-15 - TagGraphService Performance Optimization

**Learning:** Batch scoring of courses in `TagGraphService.scoreCourseRelevance` was heavily bottlenecked by redundant BFS graph expansions and course tag normalization. Partitioning the term index into a Map for single terms and an array for phrases significantly speeds up tag extraction.

**Action:** Use BFS expansion caching (Map) and course metadata caching (WeakMap) for batch operations on static graphs. Use Map lookups for single-term matching instead of O(N) regex iteration.
