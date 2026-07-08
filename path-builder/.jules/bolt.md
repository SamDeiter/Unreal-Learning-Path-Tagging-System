# Bolt's Journal - Performance Learnings

## 2025-05-15 - Initial Journal
**Learning:** Initializing journal for performance-obsessed engineering.
**Action:** Always measure before and after optimizations.

## 2025-05-15 - Tokenization in O(N^2) Loops
**Learning:** Performing string tokenization (split, filter, Set creation) inside a nested O(N^2) loop is a significant bottleneck. Pre-calculating metadata (like word Sets) in O(N) before the loop yields substantial gains.
**Action:** Always hoist expensive data transformations out of comparison loops.
