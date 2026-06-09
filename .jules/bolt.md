## 2025-05-22 - Optimize TagGraphService relevance scoring
**Learning:** Relevance scoring for courses was performing redundant tag concatenation, set creation, and suffix-matching for every course in a search result. Additionally, the graph propagation (BFS) was being re-run for every course despite target tags being constant for a search batch.
**Action:** Use a `WeakMap` to cache course-specific metadata (Sets and suffix-to-tag maps) and a `Map` to cache graph expansion results for target tags. This reduced average scoring time by ~79%.
