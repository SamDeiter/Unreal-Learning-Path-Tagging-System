## 2025-03-03 - Fix IDOR and XSS vulnerabilities

**Vulnerability:**
1. Broken Access Control (IDOR): The `token_usage` collection was global and document IDs were just dates, allowing any authenticated user to read/write others' usage data.
2. Cross-Site Scripting (XSS): Malicious content in "fix steps" could terminate a script block in a popout window via `document.write` and execute arbitrary JS.

**Learning:**
- Firestore rules must explicitly check for ownership even if data seems "anonymous" or "internal" like token counts.
- `JSON.stringify` followed by `document.write` into a `<script>` tag is unsafe if the data contains `</script>`.

**Prevention:**
- Always isolate user data under `/users/{uid}` in Firestore and enforce `auth.uid == uid`.
- Manually escape `<` as `\u003c` when injecting JSON strings into HTML `<script>` blocks.
