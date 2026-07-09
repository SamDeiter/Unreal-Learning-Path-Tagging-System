## 2025-05-15 - RegExp Hoisting in Ranking Loops
**Learning:** Creating `RegExp` objects inside hot loops (e.g., iterating over video keys or segments) is a major performance bottleneck. Hoisting `RegExp` compilation outside the loop significantly improves throughput. Additionally, using `match().length` is more efficient and consistent for occurrence counting than `split().length - 1`.
**Action:** Always check for `new RegExp()` or regex-literal creation inside loops and hoist them. Use pre-compiled global regexes for repeated keyword counting.
