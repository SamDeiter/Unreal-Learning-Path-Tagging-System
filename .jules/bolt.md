## 2025-05-22 - [Optimizing Course Matching with Hoisting and Caching]
**Learning:** High-frequency UI loops (like course matching during search) benefit significantly from hoisting expensive operations (like string tokenization) and using `WeakMap` for caching stable object metadata (normalized titles/descriptions/tags). This reduces redundant $O(N)$ string operations to $O(1)$ lookups.
**Action:** Always check for redundant string processing in loops mapping over large datasets (e.g., courses) and apply `WeakMap` caching if the objects are stable.
