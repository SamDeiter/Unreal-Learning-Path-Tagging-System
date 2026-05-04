## 2024-05-04 - [Identity-based Caching in TagGraphService]
**Learning:** High-frequency ranking functions like `scoreCourseRelevance` can be bottlenecked by redundant string operations and graph traversals. Using `WeakMap` for identity-based course metadata caching and `Map` for static graph expansion results provides a significant performance boost.
**Action:** Use `WeakMap` to cache pre-normalized metadata for immutable objects in hot loops, and `Map` to cache expensive lookup-based computations (like BFS) that are static for a given input key.
