## 2025-05-24 - TagGraphService relevance scoring optimization
**Learning:** Relevance scoring for large course libraries (2,400+ courses) is a major performance bottleneck due to redundant tag normalization and 2-hop BFS expansions on the graph. Identity-based caching (WeakMap) for course metadata and value-based caching (Map) for BFS results significantly reduce hot-path execution time.
**Action:** Use `WeakMap` for per-object metadata caching and `Map` for per-query-term traversal caching in search-heavy services.
