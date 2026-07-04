## 2025-03-24 - Optimize semantic deduplication with pre-calculated word sets
**Learning:** Performing text tokenization inside a nested loop for semantic deduplication (Jaccard similarity) creates a significant performance bottleneck (O(N^2) tokenization and Set allocations).
**Action:** Pre-calculate word sets for all items once (O(N)) and store them in a local `Map` to avoid redundant processing and mutation of domain objects. Use the inclusion-exclusion principle to calculate union size without additional allocations.
