## 2025-05-30 - TagGraphService relevance scoring optimization
**Learning:** Batch scoring thousands of courses against a tag graph is a hot path where identity-based caching (WeakMap) and graph expansion caching (Map) provide massive wins. Re-traversing the graph for every course-tag pair is redundant since the graph is static during a query batch.
**Action:** Use WeakMap for object-metadata associations and pre-calculate graph neighborhoods for query terms when doing batch similarity scoring.
