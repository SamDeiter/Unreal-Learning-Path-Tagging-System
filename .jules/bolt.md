## 2026-05-27 - Tag Graph Batch Scoring Optimization
**Learning:** The `TagGraphService.scoreCourseRelevance` method was a significant bottleneck during course library searches, as it performed redundant 2-hop BFS traversals for the same target tags across every course in a batch. Furthermore, identity-based metadata (tag sets and suffix maps) was being re-computed for every course object in every query.
**Action:** Implement identity-based caching (WeakMap) for course metadata and value-based caching (Map) for graph expansion results to reduce batch search latency by ~90%.
