# Pre-Push Security Check

This workflow ensures no secrets are leaked before pushing to GitHub.

## Before Every `git push`

// turbo-all

1. Run the secret scan:

```bash
grep -rE "(AIza|api[_-]?key|secret|password|token)" --include="*.html" --include="*.js" --include="*.json" --include="*.py" --include="*.env*" . 2>/dev/null | grep -v node_modules | grep -v ".env:" | grep -v "your_api_key_here" | grep -v "API_KEY=" | head -20
```

1. If ANY matches are found that look like real keys (not placeholders), **DO NOT PUSH**.

2. Remove the secret and use environment variables instead.

## Safe Patterns

- `.env` files (gitignored, local only)
- Placeholder values like `your_api_key_here`
- Firebase client-side keys (intentionally public, secured via domain restrictions)

## NEVER Commit

- YouTube API keys
- Gemini API keys  
- Any key starting with `AIza`
- Private keys or tokens
