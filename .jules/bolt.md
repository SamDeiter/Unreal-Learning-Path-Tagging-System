## 2025-07-24 - Docs Search Pre-computation
**Learning:** Redundant string operations (lowercasing, regex-based tokenization, stemming) inside hot loops iterating over large datasets (like `doc_links.json` with ~2700 entries) cause significant latency (~45ms per call).
**Action:** Pre-process and cache metadata (stems, lowercased fields) at load time. Use specialized matching functions (e.g., `stemMatchStems`) that operate on pre-calculated tokens to avoid O(N*M) overhead.
