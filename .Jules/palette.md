# Palette's Journal - Critical UX & Accessibility Learnings

## Philosophy
- Users notice the little things
- Accessibility is not optional
- Every interaction should feel smooth
- Good UX is invisible - it just works

## Recent & Planned Improvements
- **Goal:** Implement individual recent query deletion in Adaptive Path.
- **Why:** The "Fix a Problem" interface already supports individual deletion, but Adaptive Path only shows them without a way to remove them, creating a UX inconsistency and cluttering the interface for frequent users.
- **Accessibility:** Ensure the delete action is keyboard accessible using `:focus-within` and proper ARIA labels.
