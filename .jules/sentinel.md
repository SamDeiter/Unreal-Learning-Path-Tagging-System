## 2025-05-14 - Securing Lightweight Markdown Parsers for SCORM
**Vulnerability:** Protocol-based XSS (`javascript:`) and HTML attribute injection via unescaped quotes in a custom string-replacement Markdown parser.
**Learning:** In resource-constrained environments (like SCORM packages) where full libraries like DOMPurify or React-Markdown are avoided for overhead, a naive `replace()` approach for links is highly vulnerable. Standard entity escaping (`<`, `>`, `&`) is insufficient when user input is placed inside attributes like `href`.
**Prevention:**
1. Globally escape `"` and `'` in addition to `<`/`>`/`&` at the start of the parsing pipeline.
2. Use functional callbacks in `String.prototype.replace` for links to implement a robust protocol allowlist/blocklist before rendering the final `<a>` tag.
