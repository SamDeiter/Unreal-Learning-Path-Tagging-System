## 2025-05-15 - TagGraphService Scoring Optimization
**Learning:** Identity-based metadata caching (WeakMap) and query-tag-based BFS expansion caching (Map) provide massive speedups (approx 3.5x) for batch processing of large course libraries (2400+ entries) by eliminating redundant normalization and graph traversals.
**Action:** Use multi-level caching for services that perform iterative scoring or matching against a static dataset within a single request or batch operation.
