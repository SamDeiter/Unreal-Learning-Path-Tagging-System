"""Pass 5 — CSS Consolidation
Replace hardcoded hex color literals with CSS custom properties from App.css :root.
Only replaces in property *values* (not inside var() fallbacks or selectors).
"""
import pathlib
import re

SRC = pathlib.Path(r"c:\Users\Sam Deiter\Documents\GitHub\Unreal-Learning-Path-Tagging-System\path-builder\src")

# ── Map of hex → CSS variable name ──
# Derived from the :root block in App.css
TOKEN_MAP = {
    # Background colors
    "#0d1117": "var(--bg-primary)",
    "#161b22": "var(--bg-secondary)",
    "#21262d": "var(--bg-tertiary)",
    "#30363d": "var(--border-color)",

    # Text colors
    "#e6edf3": "var(--text-primary)",
    "#c9d1d9": "var(--text-primary)",    # close alias
    "#8b949e": "var(--text-secondary)",
    "#6e7681": "var(--text-muted)",

    # Accents
    "#58a6ff": "var(--accent-blue)",
    "#3fb950": "var(--accent-green)",
    "#a371f7": "var(--accent-purple)",
    "#d29922": "var(--accent-orange)",
    "#f85149": "var(--accent-red)",

    # Level colors (same values but for clarity)
    # These overlap with accents, so they're handled by the same mapping
}

# Files to skip (they define the tokens themselves)
SKIP_FILES = {"App.css", "index.css"}

def replace_in_file(filepath):
    """Replace hex literals with CSS variable references, avoid double-wrapping."""
    text = filepath.read_text(encoding="utf-8")
    original = text
    count = 0

    for hex_val, var_ref in TOKEN_MAP.items():
        # Case-insensitive match on the hex value
        # But DON'T replace if it's already inside a var() fallback like var(--foo, #hex)
        # Strategy: replace all occurrences, then check if we double-wrapped
        pattern = re.compile(re.escape(hex_val), re.IGNORECASE)
        matches = pattern.findall(text)
        if not matches:
            continue

        # Only replace hex values that aren't already inside a var() expression
        # Match hex NOT preceded by ", " (which indicates a var() fallback)
        # Also skip if it's in a comment line
        lines = text.split("\n")
        new_lines = []
        for line in lines:
            # Skip comment lines
            stripped = line.strip()
            if stripped.startswith("/*") or stripped.startswith("*") or stripped.startswith("//"):
                new_lines.append(line)
                continue

            # Skip lines that already use var() with this hex as fallback
            if f", {hex_val})" in line.lower() or f",{hex_val})" in line.lower():
                new_lines.append(line)
                continue

            # Skip :root definitions (lines with --)
            if re.search(r"--[\w-]+\s*:", line):
                new_lines.append(line)
                continue

            # Replace the hex value
            new_line = pattern.sub(var_ref, line)
            if new_line != line:
                count += len(pattern.findall(line))
            new_lines.append(new_line)

        text = "\n".join(new_lines)

    if text != original:
        filepath.write_text(text, encoding="utf-8")
        return count
    return 0

# ── Process all CSS files ──
total_replacements = 0
modified_files = 0

for css_file in sorted(SRC.rglob("*.css")):
    if css_file.name in SKIP_FILES:
        continue

    replacements = replace_in_file(css_file)
    if replacements > 0:
        rel = css_file.relative_to(SRC)
        print(f"  ✅ {rel}: {replacements} replacements")
        total_replacements += replacements
        modified_files += 1

print("\n─── Pass 5 Complete ───")
print(f"  {modified_files} files modified, {total_replacements} hex literals → CSS variables")
