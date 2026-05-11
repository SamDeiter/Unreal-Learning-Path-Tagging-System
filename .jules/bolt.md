## 2025-05-11 - Optimized TagGraphService.scoreCourseRelevance
**Learning:** Iterative scoring of thousands of courses against a static set of query tags in TagGraphService.scoreCourseRelevance was bottlenecked by redundant tag normalization and BFS graph traversals for every course.
**Action:** Implemented identity-based WeakMap caching for course metadata (normalized tags and suffix maps) and Map-based caching for BFS graph expansions per tag ID. This achieved a ~4.4x performance boost (0.1065ms -> 0.0243ms per course).
