## 2025-06-12 - BFS expansion caching in TagGraphService
**Learning:** Batch scoring in `TagGraphService.scoreCourseRelevance` was performing redundant graph traversals (BFS) for each course against the same query tags. Caching these expansions on the singleton instance significantly reduces the total number of graph operations.
**Action:** Always check for redundant expensive computations (like graph traversals or regex compilations) inside tight loops (like per-course scoring) and move them to a memoized helper or pre-computation step.
