## 2024-05-15 - Redundant String Operations in Search Loops
**Learning:** High-frequency UI paths (like live search or goal-matching) can suffer from O(N*M) bottlenecks where string tokenization/normalization happens redundantly inside loops for every item in a large catalog (e.g., 2,400+ courses).
**Action:** Always hoist input-dependent operations (like `goal.toLowerCase()` or `tokenize(query)`) outside of collection loops. Use `WeakMap` to cache normalized metadata for stable objects to ensure O(1) lookups during repeated search cycles.
