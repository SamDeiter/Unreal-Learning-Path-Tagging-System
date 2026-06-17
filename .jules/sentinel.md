## 2025-05-15 - [XSS in Custom Markdown Parser]
**Vulnerability:** The `markdownToHtml` utility used regex for link parsing that did not validate protocols or escape quotes, allowing `javascript:` URI execution and HTML attribute injection.
**Learning:** Even simple custom parsers require robust sanitization logic (protocol whitelisting and attribute escaping) if they are used to render untrusted content without a heavy library like DOMPurify.
**Prevention:** Always use a protocol whitelist for links and escape quotes in all attributes. Prefer established libraries like `DOMPurify` when possible, but if a lightweight string-only parser is required, implement these defenses manually.
