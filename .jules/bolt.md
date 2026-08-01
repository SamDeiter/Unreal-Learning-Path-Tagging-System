## 2026-05-22 - [Optimized Word and String Stemming Caching]
**Learning:** In local document search operations, redundant regex evaluations, string tokenization, and suffix splitting are highly expensive. Caching stems and processed strings prevents CPU-bound bottlenecks on repeated queries and document list iterations, resulting in massive speedups (~8.9x on micro-benchmarks).
**Action:** Always implement bounded in-memory `Map` caches (with safe FIFO eviction policies) in utility modules handling highly repetitive regex parsing, tokenization, or stem processing to shield the application from high CPU overhead and memory leaks.

## 2026-05-22 - [Jaccard Similarity Optimization]
**Learning:** Traditional loop-based Jaccard similarity metrics that instantiate new `Set` objects to perform set union and intersection checks on each iteration introduce significant heap allocation overhead. Using the Inclusion-Exclusion Principle ($|A \cup B| = |A| + |B| - |A \cap B|$) computes union sizes directly and avoids allocating new set objects, reducing GC pressure and execution latency.
**Action:** Utilize the Inclusion-Exclusion Principle when calculating set unions to completely eliminate intermediate Set object allocations in hot paths.
