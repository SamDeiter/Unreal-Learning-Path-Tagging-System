## 2025-05-09 - Identity-based Course Metadata Caching

**Learning:** In high-frequency batch loops (like course matching fallbacks), re-normalizing tags and building O(N) structures for thousands of courses causes significant main-thread blocking. Using `WeakMap` with the course object itself as a key allows for zero-manual-cleanup caching of these expensive pre-computations.

**Action:** Use `WeakMap` to cache normalized metadata for large data entities that are processed iteratively. Combine this with `Map` for static results (like graph expansions) to maximize throughput.
