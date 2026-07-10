## 2026-07-10 - Semantic deduplication optimization
**Learning:** Tokenizing strings and creating `Set` objects inside a nested $O(N^2)$ loop is a major bottleneck for the search pipeline. Pre-calculating word sets once ($O(N)$) and using Jaccard arithmetic (`sizeA + sizeB - intersection`) yields significant speedup.
**Action:** Use `getWordSet(text)` and `wordJaccardFromSets(setA, setB)` from `path-builder/src/utils/textSimilarity.js` for repeated word-level set operations to avoid redundant tokenization and Set allocations.
