## 2025-05-15 - XSS Tag Breakout in AnswerView Popup
**Vulnerability:** XSS in `popup.document.write`. User-controlled data (fix steps) was being injected into a `<script>` tag via `JSON.stringify`.
**Learning:** `JSON.stringify` does not escape the `<` character by default. An attacker can include `</script>` in the data to terminate the script block and execute arbitrary JS.
**Prevention:** Always escape `<` as `\u003c` when embedding JSON data directly into an HTML `<script>` block, especially when using `document.write` or server-side template injection.
