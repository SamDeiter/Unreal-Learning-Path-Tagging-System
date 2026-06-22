## 2025-03-03 - [XSS in Custom Markdown Parser]
**Vulnerability:** The `markdownToHtml` utility was vulnerable to XSS through `javascript:` protocol links and HTML attribute injection because it failed to validate URL protocols and didn't escape quotes.
**Learning:** Custom string-replace based markdown parsers are inherently risky. Global entity escaping should always include quotes, and link regexes must use a whitelist for allowed protocols.
**Prevention:** Use a battle-tested markdown library like `dompurify` or `remark` whenever possible. If a custom parser must be used, enforce strict protocol whitelisting and comprehensive attribute escaping.
