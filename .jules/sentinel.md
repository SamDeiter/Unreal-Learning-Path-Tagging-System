## 2025-05-14 - Regex-based HTML Generation Bypass
**Vulnerability:** Custom Markdown-to-HTML converter was vulnerable to XSS and attribute injection via unsafe protocols (javascript:, data:, vbscript:) and unescaped quotes in link URLs.
**Learning:** Even with protocol validation, browsers' behavior of trimming whitespace before execution can bypass simple regex checks if the input isn't sanitized (trimmed) before validation. Custom regex-based parsers are high-maintenance and prone to edge-case bypasses.
**Prevention:** Always trim and sanitize inputs before applying security rules. Prefer established, well-vetted libraries like DOMPurify or standard-compliant Markdown parsers over custom regex implementations when handling untrusted input in HTML context.
