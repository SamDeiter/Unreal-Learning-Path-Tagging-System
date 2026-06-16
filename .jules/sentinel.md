## 2025-03-03 - Markdown Link XSS Prevention
**Vulnerability:** The custom Markdown-to-HTML parser in `markdownToHtml.js` was vulnerable to XSS because it directly injected the URL from `[text](url)` into an `<a>` tag's `href` attribute without validating the protocol or escaping quotes. This allowed `javascript:` URLs and attribute injection (e.g., `" onmouseover="...`).
**Learning:** Manual regex-based HTML generation is inherently fragile. While established libraries are preferred, in cases where a lightweight custom parser is used, strict protocol whitelisting and attribute escaping are mandatory.
**Prevention:** Always use a protocol whitelist for user-provided URLs and escape double quotes when injecting strings into HTML attributes.
