## 2026-07-24 - Accessibility and Visual Gaps in Settings Components
**Learning:** Reusable popover/dialog elements like the `AccessibilityPanel` must always trap keyboard focus to satisfy WCAG requirements. Moreover, using high-quality SVG/Lucide icons instead of system-level raw emojis ensures perfect UI consistency and cross-platform accessibility, avoiding any weird glyph rendering issues.
**Action:** When designing modals or settings popovers, always include focus trapping, focus restoration via a `wasOpen` ref, and standard vector icons (such as those from `lucide-react`).
