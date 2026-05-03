## 2025-05-14 - Optimized TagGraphService scoring with BFS and identity caching

**Learning:** Identity-based caching with `WeakMap` for immutable data (like course objects) and `Map` for query-specific graph expansions in `TagGraphService.scoreCourseRelevance` yielded a ~6.2x performance boost (avg course scoring time dropped from 0.0573ms to 0.0092ms). This pattern eliminates redundant string normalization and graph traversals in high-frequency loops.

**Action:** Use `WeakMap` for per-object metadata caching and `Map` for per-query result caching in all high-frequency utility services (like `ContentGapService` or `courseMatchingUtils`).
