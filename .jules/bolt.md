
## 2026-06-19 - Pre-compiling Regex in Hot Loops
**Learning:** Constructing `new RegExp` objects inside a frequently called loop (like tag extraction from text) creates significant CPU overhead and garbage collection pressure, especially when the patterns are deterministic and known in advance.
**Action:** Pre-compile all regex patterns during the service initialization/indexing phase and store the compiled `RegExp` objects in the index for O(1) reuse during matching.
