/**
 * cleanTitle — Strip conference/brand suffixes and raw YouTube IDs from video titles.
 *
 * Examples:
 *   "Refactoring the Mesh Drawing Pipeline | Unreal Fest Europe 2019 | Unreal Engine"
 *   → "Refactoring the Mesh Drawing Pipeline"
 *
 *   "YouTube: S3likSaeZSI"
 *   → null  (caller should fall back to a step number)
 */
export function cleanTitle(raw) {
  if (!raw) return raw;
  let t = String(raw);

  // If the title is just a raw YouTube ID reference, return null so caller uses fallback
  if (/^YouTube:\s*[A-Za-z0-9_-]{8,15}$/i.test(t.trim())) return null;

  // Strip trailing pipe-delimited suffixes like "| Unreal Fest...", "| Unreal Engine", "| Epic Games"
  t = t.replace(
    /\s*\|\s*(Unreal\s+(Fest|Engine|Summit)|Epic\s+Games|GDC|Inside\s+Unreal)[^|]*/gi,
    ""
  );
  return t.trim();
}
