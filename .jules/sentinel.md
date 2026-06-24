## 2025-03-24 - XSS in markdown-to-HTML and document.write Popouts
**Vulnerability:**
1. The `markdownToHtml` utility lacked protocol validation, allowing `javascript:` and `data:` URLs in markdown links. It also failed to escape quotes in URL attributes, enabling attribute breakout.
2. `AnswerView.jsx` used `popup.document.write` to inject JSON data into a `<script>` tag without escaping `<`, allowing an attacker to close the script tag and inject arbitrary HTML/JS if they could control the input (e.g., via a malicious AI response or cached diagnosis).

**Learning:**
- Simple regex-based markdown parsers are highly prone to XSS if they don't explicitly whitelist protocols and escape all attribute values.
- Injecting JSON into HTML via `document.write` or `dangerouslySetInnerHTML` requires escaping `<` as `\u003c` to prevent `</script>` tag injection, even if the data is "safe" JSON.

**Prevention:**
- Always use a robust, well-tested markdown library or implement strict protocol whitelisting and attribute escaping.
- When embedding JSON in a script tag within an HTML string, always replace `<` with `\u003c`.
