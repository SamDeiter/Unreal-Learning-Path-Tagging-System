## 2025-05-15 - [Set-based Similarity Optimization]
**Learning:** Performing string tokenization and Set creation inside nested loops (O(N²)) is a significant bottleneck in RAG pipelines. Pre-calculating word sets once (O(N)) and using the Inclusion-Exclusion Principle (|A ∪ B| = |A| + |B| - |A ∩ B|) to avoid union Set allocations provides a ~3.3x speedup for semantic deduplication.
**Action:** Always hoist tokenization out of loops and prefer mathematical set operations over creating new Set objects for intersections or unions in performance-critical paths.
