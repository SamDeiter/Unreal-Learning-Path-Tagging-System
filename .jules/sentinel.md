## 2025-06-18 - Secure Markdown Link Parser
**Vulnerability:** XSS via dangerous protocols (javascript:, data:) and attribute injection in a custom regex-based Markdown parser.
**Learning:** Custom Markdown parsers that use simple regex `replace` for links `[text](url)` are highly susceptible to XSS if the `url` is not strictly validated against a protocol whitelist and sanitized for attribute-breaking characters like double quotes.
**Prevention:** Implement a strict protocol whitelist (allowing only http, https, mailto, tel, and relative paths) and escape double quotes in the URL before generating the HTML anchor tag. Distinguish relative paths by the absence of a scheme colon.
