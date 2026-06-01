## 2024-05-14 - TagGraphService optimization
**Learning:** Iterating over a 3.7MB JSON library (2,436 courses) for every query tag in `scoreCourseRelevance` was the primary bottleneck due to redundant normalization and BFS graph traversals.
**Action:** Use identity-based `WeakMap` to cache course metadata (normalized tags/suffixes) and a `Map` to cache BFS expansions per tag. This achieved a 5.5x speedup (384ms -> 70ms) for batch scoring.
