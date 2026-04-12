# Bolt's Performance Journal

## 2025-05-14 - Redundant Text Normalization in Course Matching
**Learning:** High-frequency UI loops (like course matching during search) are significantly slowed down by redundant string normalization and tag object parsing. For 2000 courses, these operations were happening 2000 times per search.
**Action:** Use `WeakMap` to cache pre-normalized metadata on stable course objects and hoist search-specific tokenization outside of the scoring loop.

## 2026-04-12 - Expensive Tag Iteration in Content Scoring
**Learning:** Checking keywords against an array of tags via `allTags.some(t => t.includes(kw))` is significantly slower than joining tags into a single string (`tagsBlob`) and performing a single `.includes(kw)` check.
**Action:** Pre-join course tags into a normalized `tagsBlob` and cache it using `WeakMap` to speed up multi-keyword persona scoring loops.
