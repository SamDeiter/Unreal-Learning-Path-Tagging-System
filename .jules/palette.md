# Palette Journal

## 2025-02-12 - UX Design Standardizing
**Learning:** Emojis and arbitrary symbols like literal "x" or settings gear emojis lack style consistency and often do not render correctly across platforms or respond well to CSS custom properties. Standardizing on Lucide React SVG components enables precise color, stroke width, and size control, creating a superior, predictable, and highly accessible user interface.
**Action:** Replace direct/literal unicode emoji buttons with SVG icons (e.g. `Settings`, `X`, `Volume2`, `Pause`, `Play` from `lucide-react`) in settings and reading controls, while supplying proper `aria-label` or `aria-hidden` attributes for assistive tech compatibility.
