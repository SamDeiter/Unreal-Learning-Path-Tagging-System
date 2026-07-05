# Bolt's Performance Journal

## 2025-05-14 - Initializing Journal
**Learning:** Performance optimizations should be measured with benchmarks to ensure they provide real-world benefits.
**Action:** Always create a benchmark before and after optimization.

## 2025-05-14 - $O(N^2)$ Tokenization Anti-pattern
**Learning:** Performing string tokenization and `Set` creation inside a nested loop (like semantic deduplication) creates massive overhead. Caching `Set` objects and using the Inclusion-Exclusion Principle for Jaccard similarity yields ~1000x speedup.
**Action:** Always hoist tokenization out of loops and use arithmetic for set operations when possible.
