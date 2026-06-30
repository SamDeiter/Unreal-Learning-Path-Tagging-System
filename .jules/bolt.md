## 2025-03-24 - [Hoisting RegExp and Lowercasing]
**Learning:** Compiling `RegExp` objects and normalizing strings (e.g., `toLowerCase()`) inside nested loops (O(N*M*K)) is a major bottleneck in search and ranking paths.
**Action:** Always hoist `RegExp` creation and string normalization outside of iteration loops to achieve significant latency reduction (measured ~1.72x speedup in this codebase).
