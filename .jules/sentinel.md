## 2026-06-07 - Custom Markdown Parser XSS Mitigations
**Vulnerability:** A custom markdown-to-HTML parser (`markdownToHtml.js`) lacked quote escaping and protocol validation for links, enabling Cross-Site Scripting (XSS) via attribute breakout and `javascript:` URIs.
**Learning:** Custom parsers that use simple regex replacements are highly susceptible to XSS. Unlike established libraries, they often miss edge cases like attribute injection within generated tags or unsafe URL protocols.
**Prevention:** Always escape double (`"`) and single (`'`) quotes in addition to standard HTML entities when generating HTML from untrusted input. Validate all URL protocols against a strict allowlist (e.g., `http`, `https`, `mailto`, `tel`) before rendering anchor tags.
