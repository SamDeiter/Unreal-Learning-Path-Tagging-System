/**
 * Clean raw video filenames into readable titles.
 * "100.10 08 MainLightingPartA 53" → "Main Lighting Part A"
 * "BLUEPRINTOVERVIEW" → "Blueprint Overview"
 * "YouTube: d-hv71XjkM" → null (caller uses fallback)
 */
export function cleanVideoTitle(raw) {
  if (!raw) return "Untitled Video";

  let t = String(raw).trim();

  // Detect and reject YouTube video IDs used as titles
  // Handles: "YouTube: ABC123", "You Tube: d- hv71 Xjk M", bare IDs like "d-hv71XjkM"
  const collapsed = t.replace(/\s+/g, "");
  if (/^YouTube?:?\s*[A-Za-z0-9_-]{8,15}$/i.test(collapsed)) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(collapsed) && !/\s/.test(t.trim())) return null;

  t = t
    .replace(/\.mp4$/i, "") // strip .mp4
    .replace(/_/g, " ") // underscores → spaces
    .replace(/^[A-Z]{2,5}\s+\d[\d.]*\s*/gi, "") // strip letter course codes (PGT 207.03, ANIM 101)
    .replace(/^\d+\.\d+\s*/g, "") // strip leading course code (100.10)
    .replace(/^0*\d{1,3}\s+/g, "") // strip leading sequence number (08, 03)
    .replace(/^(\w+)[ _]\1[ _]/i, "") // strip duplicated category prefix (Animation_Animation → "")
    .replace(/^(?:and|or)\s+/i, "") // strip orphan conjunctions left after cleanup
    .replace(/\s+\d{1,3}\s*(NEW|FINAL|EDIT|EDITED|OLD|DRAFT|v\d+)?\s*$/gi, "") // strip trailing "53 NEW", etc.
    .replace(/\s+(NEW|FINAL|EDIT|EDITED|OLD|DRAFT|v\d+)\s*$/gi, "") // strip standalone trailing labels
    .replace(/([a-z])(\d{2})$/g, "$1") // strip version digits fused to word end (Assets55 → Assets)
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → spaces
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2") // ABCDef → ABC Def
    .replace(/\s+(?:5[0-5]|4[0-9])$/g, "") // strip trailing UE version suffixes (49-55)
    .replace(/[-]+\s*$/g, "") // strip trailing dashes/hyphens
    .replace(/^\s*[-]+/g, "") // strip leading dashes/hyphens
    .replace(/\s{2,}/g, " ") // collapse double spaces
    .trim();

  // Handle ALL-CAPS titles with no delimiters: BLUEPRINTOVERVIEW → BLUEPRINT OVERVIEW
  // Split on known UE5 compound word boundaries in ALL-CAPS strings
  if (t === t.toUpperCase() && t.length > 10 && !/\s/.test(t)) {
    // Try to split using a dictionary of common UE5 word boundaries
    const UE5_WORDS = [
      "BLUEPRINT",
      "OVERVIEW",
      "ANIMATION",
      "CHARACTER",
      "MOVEMENT",
      "MATERIAL",
      "LIGHTING",
      "LANDSCAPE",
      "COLLISION",
      "PHYSICS",
      "PARTICLE",
      "NIAGARA",
      "GAMEPLAY",
      "ABILITY",
      "COMPONENT",
      "VARIABLE",
      "FUNCTION",
      "NETWORK",
      "REPLICATE",
      "RETARGET",
      "SKELETON",
      "SKELETAL",
      "SEQUENCE",
      "MONTAGE",
      "TUTORIAL",
      "ADVANCED",
      "BEGINNER",
      "INTERMEDIATE",
      "INTRODUCTION",
      "GETTING",
      "STARTED",
      "SETTING",
      "CREATING",
      "BUILDING",
      "SCRIPTING",
      "DEBUGGING",
      "PERFORMANCE",
      "OPTIMIZATION",
      "RENDERING",
      "EDITOR",
      "PLUGIN",
      "WIDGET",
      "CAMERA",
      "PLAYER",
      "SYSTEM",
      "CONTROL",
      "CONTROLLER",
      "INPUT",
      "EVENT",
      "GRAPH",
      "NODE",
      "ASSET",
      "IMPORT",
      "EXPORT",
      "SETUP",
      "CONFIG",
      "WORLD",
      "LEVEL",
      "ACTOR",
      "OBJECT",
      "CLASS",
      "STRUCT",
      "ENUM",
      "BASIC",
      "BASICS",
      "PART",
      "GUIDE",
      "MESH",
      "STATIC",
      "DYNAMIC",
      "AUDIO",
      "SOUND",
      "EFFECT",
      "EFFECTS",
      "DATA",
    ];
    // Greedy match: find longest matching word from left to right
    let remaining = t;
    const parts = [];
    while (remaining.length > 0) {
      let matched = false;
      // Try longest words first
      const sorted = UE5_WORDS.filter((w) => remaining.startsWith(w)).sort(
        (a, b) => b.length - a.length
      );
      if (sorted.length > 0) {
        parts.push(sorted[0]);
        remaining = remaining.slice(sorted[0].length);
        matched = true;
      }
      if (!matched) {
        // No match — take one character and keep going
        parts.push(remaining[0]);
        remaining = remaining.slice(1);
      }
    }
    t = parts
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  // Title-case ALL-CAPS results for readability
  if (t === t.toUpperCase() && t.length > 3) {
    t = t.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  // Strip conference / brand suffixes (| Unreal Fest..., | Epic Games)
  t = t
    .replace(/\s*\|\s*(Unreal\s+(Fest|Engine|Summit)|Epic\s+Games|GDC|Inside\s+Unreal)[^|]*/gi, "")
    .trim();

  return t || raw;
}
