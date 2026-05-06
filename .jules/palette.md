## 2025-05-14 - Character Counter & ARIA for Selection Groups
**Learning:** In forms with character limits and button-based type selectors (like Bug/Feature), providing a live character counter with `role="status"` and `aria-live="polite"` alongside `aria-pressed` on the buttons ensures that both visual and screen-reader users understand the state and constraints of the form.
**Action:** Always implement `aria-pressed` for toggle/selection buttons and a live-updating status for character counts in limited text areas.
