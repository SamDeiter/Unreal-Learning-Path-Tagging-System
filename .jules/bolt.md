# Bolt Journal - Performance Learnings

## 2026-03-20 - Memoization of Stemming in Document Lookup
**Learning:** In the local documentation lookup, the `stemMatch` function is called recursively across a massive static document set (2,692 items in `doc_links.json`), performing up to 4 matches per topic keyword per document. This resulted in tens of thousands of duplicate regex-based string replacements and token splits per query. Introducing dual Map-based caches for individual word stemming and full-string tokenization bypassed this overhead entirely.
**Action:** When a pure-functional string manipulation helper (like stemming, sanitization, or Jaccard tokenization) is called repeatedly in search pipelines or loops, implement synchronous Map caching for both individual words and full input strings to achieve massive (2.35x - 4.6x) speedups.
