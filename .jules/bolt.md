## 2025-03-24 - Module-level caching for localStorage

**Learning:** Synchronous `localStorage.getItem` combined with `JSON.parse` is a significant bottleneck when called within hot loops (e.g., scoring hundreds of search results). Caching the parsed object in a module-level variable provides a massive throughput increase (~180x in benchmarks). However, this introduces shared state that breaks test isolation if not handled.

**Action:** Always export a reset function (e.g., `resetFeedbackCache`) for any module-level cache and invoke it in Vitest's `beforeEach` to ensure a clean slate for every test.
