## 2025-06-27 - Tactile Feedback and ARIA refinement
**Learning:** Adding `:active` scale transforms (e.g., `scale(0.95)`) provides immediate tactile feedback that satisfies the user's need for responsiveness, even on slow-to-react async buttons. Semantic refinement (converting non-interactive badges from `<button>` to `<span>`) reduces keyboard fatigue by removing redundant tab stops.
**Action:** Always verify if a badge is actually interactive before using a `<button>` tag, and implement `aria-expanded` / `Escape` key support for all custom tooltips.
