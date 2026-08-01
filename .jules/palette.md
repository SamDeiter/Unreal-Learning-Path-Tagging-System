## 2026-08-01 - SVG Icons & Semantic ARIA roles for Popover Accessibilities

**Learning:** Replacing literal emojis or ASCII characters in interactive controls (such as the settings gear and modal close buttons) with SVG icons (e.g. from `lucide-react`) provides consistent scaling and accessibility in dark themes. Furthermore, adding explicit `aria-haspopup="dialog"`, `aria-modal="true"`, and clean label-based descriptions (`aria-label="Close settings"`) dramatically improves assistive technology experiences by explicitly signaling popover context.

**Action:** Prefer `lucide-react` icons over emojis for interactive elements and explicitly declare ARIA dialog/modal state patterns on all context menus and modal portals.
