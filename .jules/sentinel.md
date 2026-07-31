## 2026-07-31 - LLM Input Grounding Prompt Injection
**Vulnerability:** Raw, unsanitized user queries were passed directly to LLM prompts in `generateLearningPath` without validation. This allowed potential prompt injection, system prompt extraction, or content policy violations to reach the Gemini API.
**Learning:** Even when standard sanitization utility functions exist in a codebase (such as `sanitizeAndValidate` in `functions/utils/sanitizeInput.js`), individual callable endpoints may bypass them if security reviews are not comprehensive.
**Prevention:** Always route user query inputs of all LLM-powered Cloud Functions through the centralized `sanitizeAndValidate` utility before constructing prompt templates or calling any generative models.
