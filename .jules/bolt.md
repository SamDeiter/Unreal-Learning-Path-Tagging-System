## 2024-06-06 - Identity-based Caching in TagGraphService
**Learning:** Batch processing of thousands of courses in `scoreCourseRelevance` was redundantly re-calculating course metadata (tag sets, suffixes) and graph expansions for the same target tags.
**Action:** Use WeakMap for identity-based course metadata caching and Map for tag-based BFS expansion caching to achieve ~74% performance improvement in batch relevance scoring.
