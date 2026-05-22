## 2025-05-22 - Graph Propagation Caching
**Learning:** Batch scoring thousands of courses against a set of search tags is a significant performance bottleneck due to redundant 2-hop BFS traversals and repeated course tag normalization.
**Action:** Implement identity-based caching for course metadata (using `WeakMap`) and query-based caching for BFS expansions (using `Map`) to achieve a measurable (~50%+) speedup in search operations.
