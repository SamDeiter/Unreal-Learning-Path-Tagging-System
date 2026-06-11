## 2025-05-14 - [Vulnerability in Custom Markdown Parser]
**Vulnerability:** XSS and attribute injection in `markdownToHtml.js`.
**Learning:** The `markdownToHtml.js` utility, used for SCORM exports, was manually parsing links using regex and injecting URLs directly into `href` attributes without validation or escaping. This allowed `javascript:` protocol execution and attribute breakout via double quotes.
**Prevention:** Always use a protocol allowlist for URLs and escape double quotes before injecting them into HTML attributes. While a dedicated library like `DOMPurify` is preferred, standalone utilities for static exports must implement these defensive patterns manually.
