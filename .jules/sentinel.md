## 2026-08-01 - Client-side API Key Exposure via Vite Environment Variables
**Vulnerability:** The `VITE_GEMINI_API_KEY` was exposed in the client-side bundle because it was used in a frontend service (`outlineGeneratorService.js`) and prefixed with `VITE_`.
**Learning:** Any environment variable prefixed with `VITE_` in a Vite project is automatically exposed to the frontend. Unused services can still be bundled, leaking their secrets.
**Prevention:** Avoid `VITE_` prefix for sensitive keys. Always proxy AI/sensitive API calls through a secure backend or Cloud Function where the key remains server-side.
