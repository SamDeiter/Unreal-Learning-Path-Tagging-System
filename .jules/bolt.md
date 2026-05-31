## 2025-05-14 - Optimized TagGraphService scoring hot path
**Learning:** The `scoreCourseRelevance` method was a major bottleneck when processing large course libraries because it performed redundant BFS graph traversals for target tags and repeated string/array parsing for course tag metadata for every course-tag pair.
**Action:** Implement identity-based metadata caching using `WeakMap` for course objects and expansion-based caching using `Map` for tag IDs to reduce complexity from $O(C \times T \times BFS)$ to $O(C + T \times BFS)$, where $C$ is courses and $T$ is target tags.
