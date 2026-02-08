/**
 * Clean raw video filenames into readable titles.
 * "100.10 08 MainLightingPartA 53" → "Main Lighting Part A"
 */
export function cleanVideoTitle(raw) {
  if (!raw) return "Untitled Video";
  let t = raw
    .replace(/\.mp4$/i, "") // strip .mp4
    .replace(/_/g, " ") // underscores → spaces
    .replace(/^\d+\.\d+\s*/g, "") // strip leading course code (100.10)
    .replace(/^\d{1,3}\s+/g, "") // strip leading sequence number (08)
    .replace(/\s+\d{1,3}\s*(NEW|FINAL|EDIT|EDITED|OLD|DRAFT|v\d+)?\s*$/gi, "") // strip trailing "53 NEW", "53", "NEW", etc.
    .replace(/\s+(NEW|FINAL|EDIT|EDITED|OLD|DRAFT|v\d+)\s*$/gi, "") // strip standalone trailing labels
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → spaces
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2") // ABCDef → ABC Def
    .replace(/\s{2,}/g, " ") // collapse double spaces
    .trim();
  return t || raw;
}
