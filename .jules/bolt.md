## 2026-05-22 - Bounded caching in utility helpers
**Learning:** Global in-memory caches (such as Map) in helper utilities like `stemmer.js` are highly effective for performance, but when they key on unbounded inputs like arbitrary search queries, they can grow indefinitely and cause a memory leak in long-running processes.
**Action:** Always apply a conservative maximum size limit (e.g., 5,000 entries) and use a fast, built-in FIFO eviction (`map.delete(map.keys().next().value)`) in JavaScript Map to keep the memory footprint bounded and safe.
